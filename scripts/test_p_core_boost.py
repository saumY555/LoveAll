import os
import sys
import time
import ctypes
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

# 1. Disable Windows 11 EcoQoS (Power Throttling) & Set High Priority & Affinity
if sys.platform == 'win32':
    kernel32 = ctypes.windll.kernel32
    handle = kernel32.GetCurrentProcess()

    # Set priority to ABOVE_NORMAL (0x00008000) or HIGH (0x00000080)
    kernel32.SetPriorityClass(handle, 0x00008000)

    # Disable EcoQoS via SetProcessInformation
    class PROCESS_POWER_THROTTLING_STATE(ctypes.Structure):
        _fields_ = [
            ("Version", ctypes.c_ulong),
            ("ControlMask", ctypes.c_ulong),
            ("StateMask", ctypes.c_ulong),
        ]

    # ProcessPowerThrottling = 4
    # PROCESS_POWER_THROTTLING_CURRENT_VERSION = 1
    # PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1
    state = PROCESS_POWER_THROTTLING_STATE()
    state.Version = 1
    state.ControlMask = 1 # EXECUTION_SPEED
    state.StateMask = 0   # Turn OFF power throttling
    kernel32.SetProcessInformation(
        handle,
        4, # ProcessPowerThrottling
        ctypes.byref(state),
        ctypes.sizeof(state)
    )

    # Pin to P-cores only (cores 0 to 11 = 0x0FFF)
    mask = ctypes.c_uint64(0x0FFF)
    kernel32.SetProcessAffinityMask(handle, mask)
    print("[Config] Windows EcoQoS disabled, Priority=AboveNormal, Affinity=P-cores (0-11)", flush=True)

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"
img = cv2.imread(IMG_PATH)

for th in [2, 4, 6]:
    so = ort.SessionOptions()
    so.intra_op_num_threads = th
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
    valid_faces = [Face(bbox=bboxes[i, :4].astype(int), kps=kpss[i], det_score=float(bboxes[i, 4]))
                   for i in range(len(bboxes)) if bboxes[i, 4] >= 0.65 and min(bboxes[i, 2]-bboxes[i, 0], bboxes[i, 3]-bboxes[i, 1]) >= 45]
    rec.get(img, valid_faces[0])

    det_times, rec_times = [], []
    for _ in range(3):
        t0 = time.perf_counter()
        det.detect(img)
        det_times.append((time.perf_counter() - t0) * 1000)

        t1 = time.perf_counter()
        for f in valid_faces:
            rec.get(img, f)
        rec_times.append((time.perf_counter() - t1) * 1000)

    d_med = np.median(det_times)
    r_med = np.median(rec_times)
    print(f"P-CORES ONLY | Threads={th} | Detection: {d_med:6.1f} ms | Rec/face: {r_med/len(valid_faces):6.1f} ms | Rec(12): {r_med:7.1f} ms", flush=True)
