import time
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

def test_threads(threads):
    so = ort.SessionOptions()
    if threads is not None:
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1

    app = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"],
        allowed_modules=['detection', 'recognition'],
        sess_options=so
    )
    app.prepare(ctx_id=-1, det_size=(640, 640))

    det = app.models['detection']
    rec = app.models['recognition']

    # Warmup
    bboxes, kpss = det.detect(img)
    f0 = Face(bbox=bboxes[0, :4], kps=kpss[0], det_score=bboxes[0, 4])
    rec.get(img, f0)

    # 3 runs
    det_list, rec_list = [], []
    valid_faces = [Face(bbox=bboxes[i, :4].astype(int), kps=kpss[i], det_score=float(bboxes[i, 4]))
                   for i in range(len(bboxes)) if bboxes[i, 4] >= 0.65 and min(bboxes[i, 2]-bboxes[i, 0], bboxes[i, 3]-bboxes[i, 1]) >= 45]

    for _ in range(3):
        t0 = time.perf_counter()
        det.detect(img)
        det_list.append((time.perf_counter() - t0) * 1000)

        t1 = time.perf_counter()
        for f in valid_faces:
            rec.get(img, f)
        rec_list.append((time.perf_counter() - t1) * 1000)

    d_med = np.median(det_list)
    r_med = np.median(rec_list)
    effective_intra = det.session.get_session_options().intra_op_num_threads
    print(f"threads={str(threads):5s} (effective={effective_intra}) | Det: {d_med:6.1f} ms | Rec/face: {r_med/len(valid_faces):6.1f} ms | Rec(12): {r_med:7.1f} ms", flush=True)

print("Testing intra_op_num_threads values (warmup + 3 runs each):", flush=True)
for t in [None, 0, 1, 2, 4, 6]:
    test_threads(t)
