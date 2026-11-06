import time
import cv2
import os
import onnxruntime as ort
from insightface.app import FaceAnalysis

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
THREADS = int(os.environ.get("FACE_THREADS", "6"))

# Test with session options set
sess_opts = ort.SessionOptions()
sess_opts.intra_op_num_threads = THREADS
sess_opts.inter_op_num_threads = 1

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], sess_options=sess_opts)
app.prepare(ctx_id=-1, det_size=(640, 640))

# Print effective threads for each model
for name, m in app.models.items():
    cur_threads = m.session.get_session_options().intra_op_num_threads
    print(f"Model {name}: intra_threads={cur_threads}")

img = cv2.imread(IMG_PATH)
print(f"Image shape: {img.shape}")

# Run 3 trials
for trial in range(1, 4):
    print(f"\n=================== TRIAL {trial} ===================")
    t0 = time.perf_counter()
    bboxes, kpss = app.det_model.detect(img, max_num=0, metric="default")
    t_det = (time.perf_counter() - t0) * 1000
    print(f"Detection: {t_det:.2f} ms | Faces found: {len(bboxes)}")

    faces = []
    face_times = []
    total_rec = 0
    total_l3d = 0
    total_l2d = 0
    total_ga = 0

    from insightface.app.common import Face
    for i in range(len(bboxes)):
        face = Face(bbox=bboxes[i, :4], kps=kpss[i], det_score=bboxes[i, 4])
        
        # l3d
        t_l3d0 = time.perf_counter()
        app.models['landmark_3d_68'].get(img, face)
        d_l3d = (time.perf_counter() - t_l3d0) * 1000
        total_l3d += d_l3d

        # l2d
        t_l2d0 = time.perf_counter()
        app.models['landmark_2d_106'].get(img, face)
        d_l2d = (time.perf_counter() - t_l2d0) * 1000
        total_l2d += d_l2d

        # ga
        t_ga0 = time.perf_counter()
        app.models['genderage'].get(img, face)
        d_ga = (time.perf_counter() - t_ga0) * 1000
        total_ga += d_ga

        # rec
        t_rec0 = time.perf_counter()
        app.models['recognition'].get(img, face)
        d_rec = (time.perf_counter() - t_rec0) * 1000
        total_rec += d_rec

        face_total = d_l3d + d_l2d + d_ga + d_rec
        face_times.append(face_total)
        print(f"  Face {i:2d}: l3d={d_l3d:5.1f}ms, l2d={d_l2d:5.1f}ms, ga={d_ga:5.1f}ms, rec={d_rec:6.1f}ms | Total={face_total:6.1f}ms")

    sum_all = t_det + total_l3d + total_l2d + total_ga + total_rec
    print(f"\nSum of components: {sum_all:.2f} ms (Det: {t_det:.1f}ms, L3D: {total_l3d:.1f}ms, L2D: {total_l2d:.1f}ms, GA: {total_ga:.1f}ms, Rec: {total_rec:.1f}ms)")

    t_app_get0 = time.perf_counter()
    full_res = app.get(img)
    t_app_get = (time.perf_counter() - t_app_get0) * 1000
    print(f"Direct app.get(img): {t_app_get:.2f} ms")
    print(f"Difference (app.get - sum): {t_app_get - sum_all:.2f} ms")
