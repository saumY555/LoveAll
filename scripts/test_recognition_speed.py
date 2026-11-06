import time
import cv2
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], allowed_modules=['detection', 'recognition'])
app.prepare(ctx_id=-1, det_size=(640, 640))

img = cv2.imread(IMG_PATH)
bboxes, kpss = app.det_model.detect(img, max_num=0, metric="default")
rec = app.models['recognition']

print(f"Number of faces: {len(bboxes)}")

# Test 1: Calling rec on the EXACT SAME face 10 times
print("\n--- Test 1: SAME FACE (Face 0) 10 times ---")
f0 = Face(bbox=bboxes[0, :4], kps=kpss[0], det_score=bboxes[0, 4])
for i in range(10):
    t0 = time.perf_counter()
    rec.get(img, f0)
    dt = (time.perf_counter() - t0) * 1000
    print(f"  Iteration {i}: {dt:.2f} ms")

# Test 2: Calling rec on DIFFERENT faces (0 to 12)
print("\n--- Test 2: DIFFERENT FACES (Face 0 to 12) sequentially ---")
for i in range(len(bboxes)):
    fi = Face(bbox=bboxes[i, :4], kps=kpss[i], det_score=bboxes[i, 4])
    t0 = time.perf_counter()
    rec.get(img, fi)
    dt = (time.perf_counter() - t0) * 1000
    print(f"  Face {i}: {dt:.2f} ms")

# Test 3: Where inside rec.get does time go?
print("\n--- Test 3: Breakdown inside rec.get for Face 0 vs Face 1 ---")
from insightface.utils import face_align
for i in [0, 1, 2]:
    fi = Face(bbox=bboxes[i, :4], kps=kpss[i], det_score=bboxes[i, 4])
    # Step A: face_align.norm_crop
    t_crop0 = time.perf_counter()
    aimg = face_align.norm_crop(img, landmark=fi.kps, image_size=rec.input_size[0])
    t_crop = (time.perf_counter() - t_crop0) * 1000

    # Step B: blobFromImages
    t_blob0 = time.perf_counter()
    blob = cv2.dnn.blobFromImages([aimg], 1.0 / rec.input_std, rec.input_size,
                                  (rec.input_mean, rec.input_mean, rec.input_mean), swapRB=True)
    blob = rec._coerce_input_blob(blob)
    t_blob = (time.perf_counter() - t_blob0) * 1000

    # Step C: session.run
    t_ort0 = time.perf_counter()
    net_out = rec.session.run(rec.output_names, {rec.input_name: blob})[0]
    t_ort = (time.perf_counter() - t_ort0) * 1000

    print(f"  Face {i}: norm_crop={t_crop:.2f}ms, blob={t_blob:.2f}ms, ort_session_run={t_ort:.2f}ms | Total={(t_crop+t_blob+t_ort):.2f}ms")
