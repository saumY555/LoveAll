import time
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

def test_variant(label, allowed_modules=None, sess_options=None):
    kwargs = {}
    if allowed_modules is not None:
        kwargs['allowed_modules'] = allowed_modules
    if sess_options is not None:
        kwargs['sess_options'] = sess_options

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], **kwargs)
    app.prepare(ctx_id=-1, det_size=(640, 640))

    det = app.models['detection']
    rec = app.models['recognition']

    # Detect
    bboxes, kpss = det.detect(img)
    f0 = Face(bbox=bboxes[0, :4], kps=kpss[0], det_score=bboxes[0, 4])

    # Warmup recognition
    rec.get(img, f0)

    # Measure 5 runs of rec.get on f0
    times = []
    for _ in range(5):
        t0 = time.perf_counter()
        rec.get(img, f0)
        times.append((time.perf_counter() - t0) * 1000)

    print(f"{label:50s} | Rec min: {min(times):6.1f} ms | med: {np.median(times):6.1f} ms | max: {max(times):6.1f} ms", flush=True)

print("Comparing FaceAnalysis initialization options on Face 0:", flush=True)
test_variant("1. Baseline (no options)", allowed_modules=None, sess_options=None)
test_variant("2. allowed_modules=['det', 'rec']", allowed_modules=['detection', 'recognition'], sess_options=None)

so_2 = ort.SessionOptions()
so_2.intra_op_num_threads = 2
test_variant("3. sess_options(threads=2)", allowed_modules=None, sess_options=so_2)

so_6 = ort.SessionOptions()
so_6.intra_op_num_threads = 6
test_variant("4. sess_options(threads=6)", allowed_modules=None, sess_options=so_6)

test_variant("5. allowed_modules + sess_options(threads=6)", allowed_modules=['detection', 'recognition'], sess_options=so_6)
