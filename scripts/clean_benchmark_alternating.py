import os
import sys
import time
import glob
import json
import subprocess
import cv2
import numpy as np
from PIL import Image

# Import the actual production FaceEngine class
sys.path.insert(0, os.path.join(os.getcwd(), 'worker'))
from face_engine import FaceEngine

def get_cpu_clock():
    try:
        out = subprocess.check_output(
            ['powershell', '-NoProfile', '-Command', '(Get-CimInstance Win32_Processor).CurrentClockSpeed'],
            timeout=3
        ).decode().strip()
        return f"{out} MHz"
    except Exception:
        return "N/A"

def get_top_cpu_processes():
    try:
        out = subprocess.check_output(
            ['powershell', '-NoProfile', '-Command', 
             'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 -ExpandProperty ProcessName'],
            timeout=3
        ).decode().strip().splitlines()
        return ", ".join([p.strip() for p in out if p.strip()])
    except Exception:
        return "N/A"

def run_single_benchmark(run_label, intra_threads, files, out_temp):
    print(f"\n" + "=" * 90)
    print(f"STARTING {run_label}: intra_threads={intra_threads}")
    clock_start = get_cpu_clock()
    top_proc = get_top_cpu_processes()
    print(f"  CPU Clock before run: {clock_start}")
    print(f"  Top CPU Processes:    {top_proc}")
    print("=" * 90)

    # Initialize FaceEngine exactly as production does
    t0_init = time.perf_counter()
    engine = FaceEngine(model_name="buffalo_l", det_size=(640, 640), intra_threads=intra_threads)
    t1_init = time.perf_counter()
    init_time_ms = (t1_init - t0_init) * 1000.0

    t_decode_total = 0.0
    t_detect_total = 0.0
    t_embed_total = 0.0
    t_metrics_total = 0.0
    t_save_total = 0.0
    total_faces = 0

    det_model = engine.app.models['detection']
    rec_model = engine.app.models['recognition']

    for idx, fpath in enumerate(files, 1):
        # 1. Decode
        t0 = time.perf_counter()
        img_bgr = cv2.imread(fpath)
        t1 = time.perf_counter()
        t_decode_total += (t1 - t0) * 1000.0

        if img_bgr is None:
            continue
        orig_h, orig_w = img_bgr.shape[:2]

        # 2. Detection
        t0 = time.perf_counter()
        bboxes, kpss = det_model.detect(img_bgr, max_num=0, metric='default')
        t1 = time.perf_counter()
        t_detect_total += (t1 - t0) * 1000.0

        filtered_faces = []
        if bboxes is not None:
            for i in range(bboxes.shape[0]):
                bbox = bboxes[i, :4].astype(int)
                score = float(bboxes[i, 4])
                fw = int(bbox[2] - bbox[0])
                fh = int(bbox[3] - bbox[1])
                if score >= 0.48 and min(fw, fh) >= 18:
                    from insightface.app.common import Face
                    face = Face(bbox=bbox, kps=kpss[i], det_score=score)
                    filtered_faces.append(face)

        total_faces += len(filtered_faces)

        # 3. Recognition Embedding
        t0 = time.perf_counter()
        for f in filtered_faces:
            rec_model.get(img_bgr, f)
        t1 = time.perf_counter()
        t_embed_total += (t1 - t0) * 1000.0

        # 4. Metrics & Landmarks
        t0 = time.perf_counter()
        for f in filtered_faces:
            kps = f.kps.tolist() if getattr(f, 'kps', None) is not None else []
            yaw_deg = None
            roll_deg = None
            if len(kps) >= 5:
                le, re, nose = kps[0], kps[1], kps[2]
                eye_dx = re[0] - le[0]
                eye_dy = re[1] - le[1]
                eye_dist = float(np.hypot(eye_dx, eye_dy))
                if eye_dist > 1e-3:
                    eye_mid_x = (le[0] + re[0]) / 2.0
                    offset_x = (nose[0] - eye_mid_x) / (eye_dist / 2.0)
                    clamped = max(-1.0, min(1.0, offset_x))
                    yaw_deg = round(float(np.arcsin(clamped) * (180.0 / np.pi)), 1)
                    roll_deg = round(float(np.arctan2(eye_dy, eye_dx) * (180.0 / np.pi)), 1)

            bbox = f.bbox.astype(int)
            x1, y1 = max(0, bbox[0]), max(0, bbox[1])
            x2, y2 = min(orig_w, bbox[2]), min(orig_h, bbox[3])
            raw_crop = img_bgr[y1:y2, x1:x2]
            if raw_crop.size > 0:
                gray = cv2.cvtColor(raw_crop, cv2.COLOR_BGR2GRAY)
                b = float(np.mean(gray))
                g112 = cv2.resize(gray, (112, 112), interpolation=cv2.INTER_AREA)
                blur = float(cv2.Laplacian(g112, cv2.CV_64F).var())
        t1 = time.perf_counter()
        t_metrics_total += (t1 - t0) * 1000.0

        # 5. Crop Save (WebP)
        t0 = time.perf_counter()
        for f_idx, f in enumerate(filtered_faces):
            bbox = f.bbox.astype(int)
            fw = int(bbox[2] - bbox[0])
            fh = int(bbox[3] - bbox[1])
            mx = int(fw * 0.20)
            my = int(fh * 0.20)
            cx1 = max(0, bbox[0] - mx)
            cy1 = max(0, bbox[1] - my)
            cx2 = min(orig_w, bbox[2] + mx)
            cy2 = min(orig_h, bbox[3] + my)
            fcrop = img_bgr[cy1:cy2, cx1:cx2]
            if fcrop.size > 0:
                fcrop_rgb = cv2.cvtColor(fcrop, cv2.COLOR_BGR2RGB)
                pil_crop = Image.fromarray(fcrop_rgb)
                thumb = pil_crop.resize((160, 160), Image.LANCZOS)
                thumb.save(os.path.join(out_temp, f"bench_{idx}_{f_idx}.webp"), "WEBP", quality=85)
        t1 = time.perf_counter()
        t_save_total += (t1 - t0) * 1000.0

    clock_end = get_cpu_clock()
    n = len(files)
    total_pipeline = t_decode_total + t_detect_total + t_embed_total + t_metrics_total + t_save_total

    result = {
        "run_label": run_label,
        "intra_threads": intra_threads,
        "clock_start": clock_start,
        "clock_end": clock_end,
        "top_proc": top_proc,
        "photos": n,
        "faces": total_faces,
        "init_ms": round(init_time_ms, 1),
        "decode_ms_per_photo": round(t_decode_total / n, 1),
        "detect_ms_per_photo": round(t_detect_total / n, 1),
        "embed_ms_per_face": round(t_embed_total / max(1, total_faces), 1),
        "embed_ms_per_photo": round(t_embed_total / n, 1),
        "metrics_ms_per_photo": round(t_metrics_total / n, 1),
        "save_ms_per_photo": round(t_save_total / n, 1),
        "total_ms_per_photo": round(total_pipeline / n, 1),
        "total_wall_ms": round(total_pipeline, 1),
    }

    print(f"RESULTS FOR {run_label}:")
    print(f"  Decode:             {result['decode_ms_per_photo']:>6.1f} ms/photo")
    print(f"  Detection:          {result['detect_ms_per_photo']:>6.1f} ms/photo")
    print(f"  Embedding:          {result['embed_ms_per_photo']:>6.1f} ms/photo ({result['embed_ms_per_face']} ms/face)")
    print(f"  Metrics/Landmarks:  {result['metrics_ms_per_photo']:>6.1f} ms/photo")
    print(f"  Crop Save (WebP):   {result['save_ms_per_photo']:>6.1f} ms/photo")
    print(f"  Total Per Photo:    {result['total_ms_per_photo']:>6.1f} ms/photo (Wall: {result['total_wall_ms'] / 1000.0:.2f} s)")
    print(f"  CPU Clock after:    {clock_end}")
    sys.stdout.flush()
    return result

def main():
    originals_dir = os.path.join(os.getcwd(), 'storage', 'originals')
    files = sorted(glob.glob(os.path.join(originals_dir, '*.*')))[:20]
    out_temp = os.path.join(os.getcwd(), 'storage', 'faces', '_bench_tmp')
    os.makedirs(out_temp, exist_ok=True)

    print(f"Running Clean Alternating Benchmark on {len(files)} photos.")
    print("Schedule: Run 1 (intra=6) -> Run 2 (intra=0) -> Run 3 (intra=6) -> Run 4 (intra=0)")
    sys.stdout.flush()

    configs = [
        ("Run 1", 6),
        ("Run 2", 0),
        ("Run 3", 6),
        ("Run 4", 0)
    ]

    all_results = []
    for label, intra in configs:
        # Give a small 3-second cool-down/idle between runs
        time.sleep(3)
        res = run_single_benchmark(label, intra, files, out_temp)
        all_results.append(res)

    print("\n" + "=" * 105)
    print("CLEAN BENCHMARK COMPARISON TABLE (Alternating intra=6, 0, 6, 0):")
    print("=" * 105)
    print(f"{'Run':<8} {'Threads':<9} {'Clock':<10} {'Decode/p':<10} {'Detect/p':<10} {'Embed/face':<12} {'Save/p':<9} {'Total/p':<10} {'Wall Total':<10}")
    print("-" * 105)
    for r in all_results:
        print(f"{r['run_label']:<8} intra={r['intra_threads']:<3} {r['clock_start']:<10} {r['decode_ms_per_photo']:<10.1f} {r['detect_ms_per_photo']:<10.1f} {r['embed_ms_per_face']:<12.1f} {r['save_ms_per_photo']:<9.1f} {r['total_ms_per_photo']:<10.1f} {r['total_wall_ms']/1000.0:.2f}s")
    print("=" * 105)

    import shutil
    shutil.rmtree(out_temp, ignore_errors=True)

if __name__ == '__main__':
    main()
