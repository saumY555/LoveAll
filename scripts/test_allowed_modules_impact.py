import time
import cv2
import os
import onnxruntime as ort
from insightface.app import FaceAnalysis

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

print("Comparing FaceAnalysis with ALL 5 models vs ONLY ['detection', 'recognition']...\n")

for mode, modules in [("ALL 5 MODULES", None), ("ONLY ['detection', 'recognition']", ['detection', 'recognition'])]:
    print(f"================== MODE: {mode} ==================")
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], allowed_modules=modules)
    app.prepare(ctx_id=-1, det_size=(640, 640))

    # Warmup
    app.get(img)

    times = []
    for run in range(3):
        t0 = time.perf_counter()
        faces = app.get(img)
        dt = (time.perf_counter() - t0) * 1000
        times.append(dt)
        print(f"  Run {run+1}: {dt:.2f} ms ({len(faces)} faces)")

    print(f"  --> Average: {sum(times)/len(times):.2f} ms\n")
