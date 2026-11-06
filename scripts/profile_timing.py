import os
import time
import json
import glob
import cv2
import numpy as np
from PIL import Image
from insightface.app import FaceAnalysis
from sklearn.cluster import AgglomerativeClustering

def profile_50_photos():
    print("=" * 80)
    print("PROFILING 50 PHOTO DETECTIONS")
    print("=" * 80)

    # 1. Model Load
    t0 = time.time()
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'], allowed_modules=['detection', 'recognition'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    t_model_load = time.time() - t0

    # Collect available test photos
    test_photos = sorted(glob.glob('test_photos/*.jpg'))
    if not test_photos:
        test_photos = sorted(glob.glob('storage/originals/*.jpg') + glob.glob('storage/originals/*.jpeg'))
    
    # We will simulate 50 photos by cycling over test photos
    photos_50 = [test_photos[i % len(test_photos)] for i in range(50)]

    t_decode_total = 0.0
    t_detect_total = 0.0
    t_crop_save_total = 0.0
    
    total_faces = 0
    all_embeddings = []

    os.makedirs('storage/test_profile_faces', exist_ok=True)

    t_batch_start = time.time()
    for idx, p in enumerate(photos_50):
        # 2. Image Decode
        t_d0 = time.time()
        img = cv2.imread(p)
        t_decode_total += (time.time() - t_d0)

        # 3. Detection & Embedding inside app.get()
        # To measure detection vs embedding separately:
        t_det0 = time.time()
        faces = app.get(img)
        t_detect_total += (time.time() - t_det0)

        # 4. Filter & Crop Saving
        t_c0 = time.time()
        orig_h, orig_w = img.shape[:2]
        for f_idx, f in enumerate(faces):
            fw, fh = int(f.bbox[2]-f.bbox[0]), int(f.bbox[3]-f.bbox[1])
            if f.det_score >= 0.65 and min(fw, fh) >= 45:
                total_faces += 1
                all_embeddings.append(f.embedding / np.linalg.norm(f.embedding))
                
                # Crop save
                margin_x = int(fw * 0.20)
                margin_y = int(fh * 0.20)
                x1 = max(0, int(f.bbox[0]) - margin_x)
                y1 = max(0, int(f.bbox[1]) - margin_y)
                x2 = min(orig_w, int(f.bbox[2]) + margin_x)
                y2 = min(orig_h, int(f.bbox[3]) + margin_y)
                crop_bgr = img[y1:y2, x1:x2]
                if crop_bgr.size > 0:
                    crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
                    pil_crop = Image.fromarray(crop_rgb)
                    thumb = pil_crop.resize((160, 160), Image.LANCZOS)
                    thumb.save(f'storage/test_profile_faces/f_{idx}_{f_idx}.webp', 'WEBP', quality=85)
        t_crop_save_total += (time.time() - t_c0)

    # 5. Result Serialization to JSON
    t_s0 = time.time()
    dummy_result = {f"p_{i}": [{"bbox": [0,0,10,10], "score": 0.9, "emb": [0.1]*512} for _ in range(3)] for i in range(50)}
    serialized = json.dumps(dummy_result)
    t_serialization = time.time() - t_s0

    # 6. Clustering
    t_cl0 = time.time()
    if all_embeddings:
        embs = np.array(all_embeddings)
        agg = AgglomerativeClustering(n_clusters=None, metric='cosine', linkage='average', distance_threshold=0.50).fit(embs)
    t_clustering = time.time() - t_cl0

    print(f"RESULTS FOR 50 PHOTOS (Total {total_faces} faces detected):")
    print(f"  1. Model Load & Init:          {t_model_load:.3f} s")
    print(f"  2. Image Decode (OpenCV):       {t_decode_total:.3f} s  (Avg: {t_decode_total/50*1000:.1f} ms/photo)")
    print(f"  3. Detection + Embedding:       {t_detect_total:.3f} s  (Avg: {t_detect_total/50:.3f} s/photo)")
    print(f"  4. Face Crop & Thumbnail Save:  {t_crop_save_total:.3f} s  (Avg: {t_crop_save_total/50*1000:.1f} ms/photo)")
    print(f"  5. JSON Result Serialization:   {t_serialization:.3f} s")
    print(f"  6. In-Memory Clustering:        {t_clustering:.3f} s")
    print(f"  TOTAL Python Processing Time:   {t_model_load + t_decode_total + t_detect_total + t_crop_save_total + t_clustering:.2f} s")

if __name__ == '__main__':
    profile_50_photos()
