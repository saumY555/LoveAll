import ctypes
import os
import sys
import time
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

def set_affinity(mask):
    handle = ctypes.windll.kernel32.GetCurrentProcess()
    # DWORD_PTR is 64-bit unsigned int on 64-bit Windows
    mask_c = ctypes.c_uint64(mask)
    success = ctypes.windll.kernel32.SetProcessAffinityMask(handle, mask_c)
    if not success:
        err = ctypes.windll.kernel32.GetLastError()
        print(f"Failed to set affinity mask {hex(mask)}, error: {err}")

def benchmark_run(intra_threads, mask=None, label=""):
    if mask is not None:
        set_affinity(mask)
    else:
        set_affinity(0xFFFF) # all 16 cores

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

    # Pre-warm
    bboxes, kpss = det_model.detect(img, max_num=0, metric='default')
    valid_faces = []
    for i in range(len(bboxes)):
        score = float(bboxes[i, 4])
        bbox = bboxes[i, :4].astype(int)
        if score >= 0.65 and min(bbox[2]-bbox[0], bbox[3]-bbox[1]) >= 45:
            valid_faces.append(Face(bbox=bbox, kps=kpss[i], det_score=score))

    rec_model.get(img, valid_faces[0])

    det_times = []
    rec_times = []
    for _ in range(3):
        t0 = time.perf_counter()
        det_model.detect(img, max_num=0, metric='default')
        det_times.append((time.perf_counter() - t0) * 1000)

        t1 = time.perf_counter()
        for vf in valid_faces:
            rec_model.get(img, vf)
        rec_times.append((time.perf_counter() - t1) * 1000)

    d_med = np.median(det_times)
    r_med = np.median(rec_times)
    r_per = r_med / len(valid_faces)
    print(f"{label:40s} | Det: {d_med:7.2f} ms | Rec/face: {r_per:7.2f} ms | Rec(12): {r_med:8.2f} ms", flush=True)

print("=" * 85)
print("BENCHMARKING THREADS AND CORE AFFINITY")
print("=" * 85)

# 1. P-cores only (cores 0 to 11 = 0x0FFF)
benchmark_run(1, 0x0FFF, "Threads=1 (P-cores 0-11)")
benchmark_run(2, 0x0FFF, "Threads=2 (P-cores 0-11)")
benchmark_run(4, 0x0FFF, "Threads=4 (P-cores 0-11)")
benchmark_run(6, 0x0FFF, "Threads=6 (P-cores 0-11)")

# 2. Physical P-cores only (no HT: cores 0, 2, 4, 6, 8, 10 = 0x0555)
benchmark_run(2, 0x0555, "Threads=2 (Physical P-cores)")
benchmark_run(4, 0x0555, "Threads=4 (Physical P-cores)")
benchmark_run(6, 0x0555, "Threads=6 (Physical P-cores)")

# 3. E-cores only (cores 12 to 15 = 0xF000)
benchmark_run(2, 0xF000, "Threads=2 (E-cores 12-15)")
benchmark_run(4, 0xF000, "Threads=4 (E-cores 12-15)")

# 4. All cores (default OS scheduling)
benchmark_run(2, 0xFFFF, "Threads=2 (All cores 0-15)")
benchmark_run(4, 0xFFFF, "Threads=4 (All cores 0-15)")
benchmark_run(6, 0xFFFF, "Threads=6 (All cores 0-15)")
