import os
import sys
import time
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

def test_config(intra_threads, affinity_mask=None):
    if affinity_mask is not None and hasattr(os, 'sched_setaffinity'):
        try:
            os.sched_setaffinity(0, affinity_mask)
        except Exception:
            pass
    elif affinity_mask is not None and sys.platform == 'win32':
        import ctypes
        from ctypes import wintypes
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        ctypes.windll.kernel32.SetProcessAffinityMask(handle, wintypes.ULONG_PTR(affinity_mask))

    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = intra_threads
    sess_opts.inter_op_num_threads = 1
    sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    app = FaceAnalysis(
        name='buffalo_l',
        providers=['CPUExecutionProvider'],
        allowed_modules=['detection', 'recognition'],
        sess_options=sess_opts
    )
    app.prepare(ctx_id=-1, det_size=(640, 640))

    det_model = app.models['detection']
    rec_model = app.models['recognition']

    # Warmup
    bboxes, kpss = det_model.detect(img, max_num=0, metric='default')
    from insightface.app.common import Face
    f0 = Face(bbox=bboxes[0, :4], kps=kpss[0], det_score=bboxes[0, 4])
    rec_model.get(img, f0)

    # Measure 3 runs
    det_times = []
    rec_times = []
    for _ in range(3):
        t0 = time.perf_counter()
        bboxes, kpss = det_model.detect(img, max_num=0, metric='default')
        det_times.append((time.perf_counter() - t0) * 1000)

        # Run recognition on all 12 valid faces
        valid_faces = []
        for i in range(len(bboxes)):
            score = float(bboxes[i, 4])
            bbox = bboxes[i, :4].astype(int)
            if score >= 0.65 and min(bbox[2]-bbox[0], bbox[3]-bbox[1]) >= 45:
                valid_faces.append(Face(bbox=bbox, kps=kpss[i], det_score=score))

        t1 = time.perf_counter()
        for vf in valid_faces:
            rec_model.get(img, vf)
        rec_times.append((time.perf_counter() - t1) * 1000)

    return np.median(det_times), np.median(rec_times), len(valid_faces)

print(f"{'Config':35s} | {'Det (ms)':10s} | {'Rec Total (12 faces)':20s} | {'Rec/face (ms)':12s}")
print("-" * 85)

# Test various thread counts with default affinity
for th in [1, 2, 4, 6, 8, 12, 16]:
    d, r, n = test_config(th)
    print(f"Threads={th:2d} (default affinity)        | {d:10.2f} | {r:20.2f} | {r/n:12.2f}")

# On i5-13450HX: 6 P-cores with HT = logical cores 0-11 (mask 0x0FFF)
# 4 E-cores = logical cores 12-15 (mask 0xF000)
mask_p_cores = 0x0FFF # cores 0-11
mask_e_cores = 0xF000 # cores 12-15
mask_p_physical = 0x0555 # 1 thread per P-core (cores 0, 2, 4, 6, 8, 10)

print("-" * 85)
d, r, n = test_config(6, mask_p_cores)
print(f"Threads= 6 (P-cores only 0-11)        | {d:10.2f} | {r:20.2f} | {r/n:12.2f}")

d, r, n = test_config(6, mask_p_physical)
print(f"Threads= 6 (P-cores physical 6c)      | {d:10.2f} | {r:20.2f} | {r/n:12.2f}")

d, r, n = test_config(4, mask_e_cores)
print(f"Threads= 4 (E-cores only 12-15)       | {d:10.2f} | {r:20.2f} | {r/n:12.2f}")
