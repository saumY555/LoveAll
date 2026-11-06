import time
import cv2
import onnxruntime as ort
from insightface.app import FaceAnalysis

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

configs = [
    ("detection only", ['detection']),
    ("detection + recognition", ['detection', 'recognition']),
    ("detection + recognition + genderage", ['detection', 'recognition', 'genderage']),
    ("detection + recognition + landmark_2d_106", ['detection', 'recognition', 'landmark_2d_106']),
    ("detection + recognition + landmark_3d_68", ['detection', 'recognition', 'landmark_3d_68']),
    ("ALL 5 models", ['detection', 'recognition', 'genderage', 'landmark_2d_106', 'landmark_3d_68']),
]

for label, mods in configs:
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], allowed_modules=mods)
    app.prepare(ctx_id=-1, det_size=(640, 640))
    app.get(img) # warmup
    t0 = time.perf_counter()
    for _ in range(3):
        faces = app.get(img)
    avg_ms = ((time.perf_counter() - t0) / 3) * 1000
    print(f"{label:42s}: {avg_ms:7.2f} ms")
