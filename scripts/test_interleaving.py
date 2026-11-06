import time
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))

bboxes, kpss = app.det_model.detect(img, max_num=0, metric="default")
print(f"Detected bboxes: {len(bboxes)}")

# Create Face objects
faces = [Face(bbox=bboxes[i, :4], kps=kpss[i], det_score=bboxes[i, 4]) for i in range(len(bboxes))]

# Test 1: Batched by model (Model A on all 13 faces, then Model B on all 13 faces)
for name, m in app.models.items():
    if name == "detection": continue
    # Warmup
    m.get(img, faces[0])
    
    t0 = time.perf_counter()
    for f in faces:
        m.get(img, f)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"Batched {name:16s} (all {len(faces)} faces): {elapsed_ms:7.2f} ms ({elapsed_ms/len(faces):.2f} ms/face)")

# Test 2: Interleaved (as app.get does: for each face, run all 4 models)
t0 = time.perf_counter()
for f in faces:
    for name, m in app.models.items():
        if name == "detection": continue
        m.get(img, f)
elapsed_ms = (time.perf_counter() - t0) * 1000
print(f"Interleaved (all 4 models per face): {elapsed_ms:7.2f} ms")
