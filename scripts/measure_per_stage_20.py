import os
import sys
import time
import glob
import cv2
import numpy as np
from PIL import Image
from insightface.app import FaceAnalysis

def main():
    originals_dir = os.path.join(os.getcwd(), 'storage', 'originals')
    files = sorted(glob.glob(os.path.join(originals_dir, '*.*')))[:20]
    if not files:
        print("No files found!")
        return

    print(f"Initializing FaceAnalysis with intra_threads=6...")
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'], allowed_modules=['detection', 'recognition'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    import onnxruntime as ort
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 6
    opts.inter_op_num_threads = 1
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    for mod_name, mod in app.models.items():
        if hasattr(mod, 'session') and hasattr(mod, 'model_file'):
            mod.session = ort.InferenceSession(mod.model_file, opts, providers=['CPUExecutionProvider'])

    out_temp = os.path.join(os.getcwd(), 'storage', 'faces', '_test_tmp')
    os.makedirs(out_temp, exist_ok=True)

    print(f"Loaded {len(files)} photos for per-stage timing benchmark.")

    t_decode_total = 0.0
    t_detect_total = 0.0
    t_embed_total = 0.0
    t_metrics_total = 0.0
    t_save_total = 0.0
    total_faces_detected = 0

    print("\nPhoto-by-photo measurements:")
    print(f"{'Idx':<4} {'Photo File':<20} {'Size':<12} {'Faces':<6} {'Decode(ms)':<11} {'Detect(ms)':<11} {'Embed(ms)':<11} {'Metrics(ms)':<12} {'Save(ms)':<10} {'Total(ms)':<10}")
    print("-" * 115)

    for idx, fpath in enumerate(files, 1):
        fname = os.path.basename(fpath)[:18] + '..'
        # 1. Decode
        t0 = time.perf_counter()
        img = cv2.imread(fpath)
        t1 = time.perf_counter()
        t_decode = (t1 - t0) * 1000.0
        t_decode_total += t_decode

        if img is None:
            continue
        h, w = img.shape[:2]
        dim_str = f"{w}x{h}"

        # 2. Detection only
        det_model = app.models['detection']
        t0 = time.perf_counter()
        bboxes, kpss = det_model.detect(img, max_num=0, metric='default')
        t1 = time.perf_counter()
        t_detect = (t1 - t0) * 1000.0
        t_detect_total += t_detect

        # Filter by conf 0.48, min_size 18
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

        n_faces = len(filtered_faces)
        total_faces_detected += n_faces

        # 3. Embedding only
        rec_model = app.models['recognition']
        t0 = time.perf_counter()
        for f in filtered_faces:
            rec_model.get(img, f)
        t1 = time.perf_counter()
        t_embed = (t1 - t0) * 1000.0
        t_embed_total += t_embed

        # 4. Metrics & landmarks
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
            x2, y2 = min(w, bbox[2]), min(h, bbox[3])
            raw_crop = img[y1:y2, x1:x2]
            if raw_crop.size > 0:
                gray = cv2.cvtColor(raw_crop, cv2.COLOR_BGR2GRAY)
                b = float(np.mean(gray))
                g112 = cv2.resize(gray, (112, 112), interpolation=cv2.INTER_AREA)
                blur = float(cv2.Laplacian(g112, cv2.CV_64F).var())
        t1 = time.perf_counter()
        t_metrics = (t1 - t0) * 1000.0
        t_metrics_total += t_metrics

        # 5. Crop Save
        t0 = time.perf_counter()
        for f_idx, f in enumerate(filtered_faces):
            bbox = f.bbox.astype(int)
            fw = int(bbox[2] - bbox[0])
            fh = int(bbox[3] - bbox[1])
            mx = int(fw * 0.20)
            my = int(fh * 0.20)
            cx1 = max(0, bbox[0] - mx)
            cy1 = max(0, bbox[1] - my)
            cx2 = min(w, bbox[2] + mx)
            cy2 = min(h, bbox[3] + my)
            fcrop = img[cy1:cy2, cx1:cx2]
            if fcrop.size > 0:
                fcrop_rgb = cv2.cvtColor(fcrop, cv2.COLOR_BGR2RGB)
                pil_crop = Image.fromarray(fcrop_rgb)
                thumb = pil_crop.resize((160, 160), Image.LANCZOS)
                thumb.save(os.path.join(out_temp, f"temp_{idx}_{f_idx}.webp"), "WEBP", quality=85)
        t1 = time.perf_counter()
        t_save = (t1 - t0) * 1000.0
        t_save_total += t_save

        p_total = t_decode + t_detect + t_embed + t_metrics + t_save
        print(f"{idx:<4} {fname:<20} {dim_str:<12} {n_faces:<6} {t_decode:<11.1f} {t_detect:<11.1f} {t_embed:<11.1f} {t_metrics:<12.1f} {t_save:<10.1f} {p_total:<10.1f}")

    n = len(files)
    print("=" * 115)
    print(f"SUMMARY FOR {n} PHOTOS ({total_faces_detected} faces detected):")
    print(f"  Decode:             {t_decode_total:>8.1f} ms total  ({t_decode_total/n:>6.1f} ms/photo)")
    print(f"  Detection:          {t_detect_total:>8.1f} ms total  ({t_detect_total/n:>6.1f} ms/photo)")
    print(f"  Embedding:          {t_embed_total:>8.1f} ms total  ({t_embed_total/n:>6.1f} ms/photo, {t_embed_total/max(1, total_faces_detected):>6.1f} ms/face)")
    print(f"  Metrics/Landmarks:  {t_metrics_total:>8.1f} ms total  ({t_metrics_total/n:>6.1f} ms/photo)")
    print(f"  Crop Save (WEBP):   {t_save_total:>8.1f} ms total  ({t_save_total/n:>6.1f} ms/photo)")
    p_sum = t_decode_total + t_detect_total + t_embed_total + t_metrics_total + t_save_total
    print(f"  Python Subtotal:    {p_sum:>8.1f} ms total  ({p_sum/n:>6.1f} ms/photo)")
    print("=" * 115)

    # Clean up test temp crops
    import shutil
    shutil.rmtree(out_temp, ignore_errors=True)

if __name__ == '__main__':
    main()
