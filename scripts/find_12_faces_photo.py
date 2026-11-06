import os, sys, cv2
import onnxruntime as ort
from insightface.app import FaceAnalysis

folder = r"C:\Users\LENOVO\OneDrive\Pictures\Nepal trip 2k26"
app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], allowed_modules=["detection"])
app.prepare(ctx_id=-1, det_size=(640, 640))

for fname in os.listdir(folder):
    if fname.lower().endswith(".jpg"):
        fpath = os.path.join(folder, fname)
        img = cv2.imread(fpath)
        if img is None: continue
        if img.shape[:2] in [(3060, 4080), (4080, 3060)]:
            bboxes, _ = app.det_model.detect(img, max_num=0, metric="default")
            if len(bboxes) == 12:
                print(f"FOUND 12 FACES PHOTO: {fname} -> {fpath}")
                break
            elif len(bboxes) > 8:
                print(f"Candidate: {fname} has {len(bboxes)} faces")
