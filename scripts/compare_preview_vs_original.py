import os
import time
import json
import cv2
import numpy as np
from PIL import Image
from insightface.app import FaceAnalysis
from sklearn.cluster import AgglomerativeClustering

test_photos = [
    {
        "id": "cmw1p7r3o000jwd685awd6ktt",
        "name": "20260524_090936 - Copy.jpg",
        "orig": "storage/originals/c142e7a9d8f69b6e5edc1e8957a43bb45262c69acada751dc8535b0eec6473b1.jpg",
        "prev": "storage/previews/c142e7a9d8f69b6e5edc1e8957a43bb45262c69acada751dc8535b0eec6473b1.webp"
    },
    {
        "id": "cmw1p7pmk000dwd68jcvj1v3j",
        "name": "20260524_090926 - Copy.jpg",
        "orig": "storage/originals/c97f56692c61bfb7348c48cf1ea6b91df357db085903cb396ce2785049a40421.jpg",
        "prev": "storage/previews/c97f56692c61bfb7348c48cf1ea6b91df357db085903cb396ce2785049a40421.webp"
    },
    {
        "id": "cmw1qwvr000dewdo03hlhh4e9",
        "name": "20260527_103808.jpg",
        "orig": "storage/originals/31b87d520c177ac5d6b4074497d11e355eb7e2e6a8526601f99554734ea0b1b3.jpg",
        "prev": "storage/previews/31b87d520c177ac5d6b4074497d11e355eb7e2e6a8526601f99554734ea0b1b3.webp"
    },
    {
        "id": "cmw1qx1jm00e2wdo0ryl8vnmj",
        "name": "20260527_121639 - Copy.jpg",
        "orig": "storage/originals/a46665787b60ff4f318ca2371f32c38229252716363e0cc853750bb5c7e3570f.jpg",
        "prev": "storage/previews/a46665787b60ff4f318ca2371f32c38229252716363e0cc853750bb5c7e3570f.webp"
    },
    {
        "id": "cmw1qwy3f00dnwdo0p1i5a6ug",
        "name": "20260527_103816 - Copy.jpg",
        "orig": "storage/originals/a1cfe5ea94568a7f27af397be13cca57f6d1282eade7f4f038dfcac267aeedfc.jpg",
        "prev": "storage/previews/a1cfe5ea94568a7f27af397be13cca57f6d1282eade7f4f038dfcac267aeedfc.webp"
    },
    {
        "id": "cmw1qx2dh00e8wdo0ydqzx08d",
        "name": "20260527_121640.jpg",
        "orig": "storage/originals/8b2749c1284d1a099d2335ce2e36b9d90ef2ad2440e725213b997b6c067b047a.jpg",
        "prev": "storage/previews/8b2749c1284d1a099d2335ce2e36b9d90ef2ad2440e725213b997b6c067b047a.webp"
    },
    {
        "id": "cmw1p7mx00006wd681x3hl7zz",
        "name": "20260524_090909 - Copy.jpg",
        "orig": "storage/originals/73f51fc64aa97df17381749b9dbe9cba6f935267acc1324ababb3cb77b38c135.jpg",
        "prev": "storage/previews/73f51fc64aa97df17381749b9dbe9cba6f935267acc1324ababb3cb77b38c135.webp"
    },
    {
        "id": "cmw1qwv4o00d9wdo05dhi9jqc",
        "name": "20260527_103749 - Copy.jpg",
        "orig": "storage/originals/c39d42ad86ecc6d80ead111b55e89cc08c339b2e085cac2ff31d4cd2dc7157c5.jpg",
        "prev": "storage/previews/c39d42ad86ecc6d80ead111b55e89cc08c339b2e085cac2ff31d4cd2dc7157c5.webp"
    },
    {
        "id": "cmw1qhdqj0027wdo05d09lh34",
        "name": "Snapchat-2007618767 - Copy.jpg",
        "orig": "storage/originals/9f9f2f000f4c32fe31ee7614f809a39f3d9275841f8aa04438085ea8134b5a62.jpg",
        "prev": "storage/previews/9f9f2f000f4c32fe31ee7614f809a39f3d9275841f8aa04438085ea8134b5a62.webp"
    },
    {
        "id": "cmw1qwq4400cqwdo0z7ti23p3",
        "name": "20260526_174843 - Copy.jpg",
        "orig": "storage/originals/a2affae73ad2159d63546d9ceffb891e25075ca00e3f93d5f3a509e0cb255a9e.jpg",
        "prev": "storage/previews/a2affae73ad2159d63546d9ceffb891e25075ca00e3f93d5f3a509e0cb255a9e.webp"
    }
]

def run_mode(app, photo_paths_key, mode_name, min_face_size=45, generate_1600=False):
    print(f"\n--- Running: {mode_name} (min_face_size={min_face_size}) ---")
    results = []
    all_embeddings = []
    
    t_start = time.time()
    for item in test_photos:
        if generate_1600:
            # Generate 1600px preview from original
            orig_img = cv2.imread(item["orig"])
            h, w = orig_img.shape[:2]
            scale = 1600 / max(h, w)
            img = cv2.resize(orig_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            path = item[photo_paths_key]
            img = cv2.imread(path)

        h, w = img.shape[:2]
        t0 = time.time()
        faces = app.get(img)
        dt = time.time() - t0

        kept_faces = []
        smallest_w = 999999
        smallest_h = 999999

        for f in faces:
            fw = int(f.bbox[2] - f.bbox[0])
            fh = int(f.bbox[3] - f.bbox[1])
            score = float(f.det_score)

            if score >= 0.65 and min(fw, fh) >= min_face_size:
                kept_faces.append(f)
                if min(fw, fh) < min(smallest_w, smallest_h):
                    smallest_w = fw
                    smallest_h = fh
                emb = f.embedding / np.linalg.norm(f.embedding)
                all_embeddings.append(emb)

        results.append({
            "name": item["name"][:20],
            "res": f"{w}x{h}",
            "faces_raw": len(faces),
            "faces_kept": len(kept_faces),
            "smallest": f"{smallest_w}x{smallest_h}" if kept_faces else "N/A",
            "time_ms": int(dt * 1000)
        })

    total_time = time.time() - t_start

    # Run clustering
    num_clusters = 0
    if len(all_embeddings) >= 2:
        embs = np.array(all_embeddings)
        agg = AgglomerativeClustering(n_clusters=None, metric='cosine', linkage='average', distance_threshold=0.50).fit(embs)
        # count clusters with >= 2 faces
        counts = {}
        for l in agg.labels_:
            counts[l] = counts.get(l, 0) + 1
        num_clusters = len([c for c, count in counts.items() if count >= 2])
    elif len(all_embeddings) == 1:
        num_clusters = 1

    return {
        "mode": mode_name,
        "results": results,
        "total_faces_kept": len(all_embeddings),
        "total_people_clusters": num_clusters,
        "total_time_s": round(total_time, 2)
    }

def main():
    print("Loading buffalo_l model...")
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'], allowed_modules=['detection', 'recognition'])
    app.prepare(ctx_id=0, det_size=(640, 640))

    # 1. Mode 1: Originals with min_face_size=45
    mode_orig = run_mode(app, "orig", "Originals (Full Res)", min_face_size=45)

    # 2. Mode 2: 960px Previews with min_face_size=45
    mode_prev_45 = run_mode(app, "prev", "960px Previews (min_size=45)", min_face_size=45)

    # 3. Mode 3: 1600px Previews with min_face_size=45 (as requested if preview loses faces)
    mode_1600 = run_mode(app, "orig", "1600px Previews (min_size=45)", min_face_size=45, generate_1600=True)

    print("\n" + "=" * 100)
    print("COMPARISON SUMMARY TABLE ACROSS 10 GROUP PHOTOS")
    print("=" * 100)
    print(f"{'Photo Name':<22} | {'Original (45px)':<18} | {'960px Prev (45px)':<18} | {'1600px Prev (45px)':<18}")
    print("-" * 100)
    for i in range(10):
        r1 = mode_orig['results'][i]
        r2 = mode_prev_45['results'][i]
        r3 = mode_1600['results'][i]
        s1 = f"{r1['faces_kept']} faces (min:{r1['smallest']})"
        s2 = f"{r2['faces_kept']} faces (min:{r2['smallest']})"
        s3 = f"{r3['faces_kept']} faces (min:{r3['smallest']})"
        print(f"{r1['name']:<22} | {s1:<18} | {s2:<18} | {s3:<18}")

    print("-" * 100)
    print(f"{'TOTAL FACES KEPT':<22} | {mode_orig['total_faces_kept']:<18} | {mode_prev_45['total_faces_kept']:<18} | {mode_1600['total_faces_kept']:<18}")
    print(f"{'PEOPLE CLUSTERS':<22} | {mode_orig['total_people_clusters']:<18} | {mode_prev_45['total_people_clusters']:<18} | {mode_1600['total_people_clusters']:<18}")
    print(f"{'TOTAL INFERENCE TIME':<22} | {mode_orig['total_time_s']}s{'':<14} | {mode_prev_45['total_time_s']}s{'':<14} | {mode_1600['total_time_s']}s{'':<14}")
    print("=" * 100)

if __name__ == '__main__':
    main()
