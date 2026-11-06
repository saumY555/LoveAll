import sys, time, os, statistics
import cv2, onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

IMG = sys.argv[1]
THREADS = int(os.environ.get("FACE_THREADS", "6"))

# Force the thread count into every ONNX session (may need adjusting for your version)
_orig = ort.InferenceSession
def patched(path, sess_options=None, providers=None, **kw):
    so = sess_options or ort.SessionOptions()
    so.intra_op_num_threads = THREADS
    so.inter_op_num_threads = 1
    return _orig(path, sess_options=so, providers=providers, **kw)
ort.InferenceSession = patched

print("cpu_count:", os.cpu_count(), "| threads:", THREADS, "| ort:", ort.__version__)
try:
    import psutil
    print("physical cores:", psutil.cpu_count(logical=False))
except ImportError:
    print("pip install psutil to see physical cores")

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))
print("models loaded:", {k: type(v).__name__ for k, v in app.models.items()})

img = cv2.imread(IMG)
print("image shape:", img.shape)

def t(fn, n=5):
    fn()  # warm-up
    xs = []
    for _ in range(n):
        s = time.perf_counter(); fn(); xs.append((time.perf_counter() - s) * 1000)
    return f"median {statistics.median(xs):.0f} ms (min {min(xs):.0f}, max {max(xs):.0f})"

print("full app.get():", t(lambda: app.get(img)))

bboxes, kpss = app.det_model.detect(img, max_num=0, metric="default")
print("faces found:", len(bboxes))
print("detection only:", t(lambda: app.det_model.detect(img, max_num=0, metric="default")))

if len(bboxes):
    face = Face(bbox=bboxes[0, :4], kps=kpss[0], det_score=bboxes[0, 4])
    for name, m in app.models.items():
        if name == "detection":
            continue
        print(f"{name} (one face):", t(lambda m=m: m.get(img, face)))