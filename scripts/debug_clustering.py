import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis
from sklearn.cluster import DBSCAN, AgglomerativeClustering, HDBSCAN
from sklearn.metrics.pairwise import cosine_similarity

def main():
    print("=" * 80)
    print("STEP 1: INSPECTION OF CURRENT vs NEW PIPELINE CONFIGURATION")
    print("=" * 80)
    print("CURRENT PRODUCTION PIPELINE:")
    print("  - Detection Model: UltraFace ONNX (version-RFB-320.onnx)")
    print("  - Detection Resolution: Fixed 320x240 resize (squashing high-res camera photos)")
    print("  - Detection Confidence Threshold: 0.65")
    print("  - Face Alignment: NONE (raw bounding box crop resized directly to 112x112)")
    print("  - Embedding Model: MobileFaceNet (w600k_mbf.onnx, 512-d)")
    print("  - Clustering Method: DBSCAN (eps=0.45, min_samples=2, metric='cosine')")
    print("  - Critical Bug in current hard_nms: ious[0] scalar indexing causing crashes on multi-face images")
    print()

    print("=" * 80)
    print("STEP 2: RUNNING INSIGHTFACE (buffalo_l, det_size=1280x1280) ON TEST PHOTOS")
    print("=" * 80)

    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(1280, 1280))

    test_dir = 'test_photos'
    photos = sorted([f for f in os.listdir(test_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

    all_faces = []
    face_idx = 0

    min_face_size = 45  # Filter out tiny background passerby faces (e.g. 24x36px)
    min_det_score = 0.65

    for photo_name in photos:
        p_path = os.path.join(test_dir, photo_name)
        img = cv2.imread(p_path)
        h, w = img.shape[:2]
        
        raw_faces = app.get(img)
        print(f"\nPhoto: {photo_name} (Resolution: {w}x{h})")
        print(f"  Total raw detections: {len(raw_faces)}")

        for f in raw_faces:
            face_idx += 1
            bbox = f.bbox.astype(int)
            fw = bbox[2] - bbox[0]
            fh = bbox[3] - bbox[1]
            det_score = float(f.det_score)
            
            # Check filtering
            filtered = False
            filter_reason = "Passed"
            if det_score < min_det_score:
                filtered = True
                filter_reason = f"Low det_score ({det_score:.3f} < {min_det_score})"
            elif min(fw, fh) < min_face_size:
                filtered = True
                filter_reason = f"Too small ({fw}x{fh} < {min_face_size}px min size)"

            status_str = f"FILTERED: {filter_reason}" if filtered else "KEPT"
            print(f"    Face #{face_idx} in {photo_name}: BBox=[{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}] ({fw}x{fh}px), Score={det_score:.4f} -> {status_str}")

            if not filtered:
                # Normalize embedding
                emb = f.embedding
                emb = emb / np.linalg.norm(emb)
                all_faces.append({
                    "global_id": f"F{len(all_faces)+1}",
                    "photo": photo_name,
                    "bbox": [int(b) for b in bbox],
                    "size": f"{fw}x{fh}",
                    "score": det_score,
                    "embedding": emb
                })

    print(f"\nTotal high-quality faces kept for clustering: {len(all_faces)}")

    print("\n" + "=" * 80)
    print("STEP 3: COSINE SIMILARITY MATRIX")
    print("=" * 80)

    embeddings = np.array([f["embedding"] for f in all_faces])
    labels = [f"{f['global_id']}({f['photo'][:8]})" for f in all_faces]
    
    sim_matrix = cosine_similarity(embeddings)

    header = f"{'Face':<16}" + "".join([f"{l:>14}" for l in labels])
    print(header)
    print("-" * len(header))
    for i, row in enumerate(sim_matrix):
        row_str = f"{labels[i]:<16}" + "".join([f"{val:>14.3f}" for val in row])
        print(row_str)

    print("\n" + "=" * 80)
    print("STEP 4: SIMILARITY ANALYSIS & PROPOSED THRESHOLDS")
    print("=" * 80)
    # Calculate same-photo vs cross-photo pairs
    cross_photo_pairs = []
    same_photo_pairs = []
    for i in range(len(all_faces)):
        for j in range(i + 1, len(all_faces)):
            sim = sim_matrix[i, j]
            pair_info = (sim, all_faces[i]['global_id'], all_faces[j]['global_id'], all_faces[i]['photo'], all_faces[j]['photo'])
            if all_faces[i]['photo'] == all_faces[j]['photo']:
                same_photo_pairs.append(pair_info)
            else:
                cross_photo_pairs.append(pair_info)

    same_photo_pairs.sort(reverse=True)
    cross_photo_pairs.sort(reverse=True)

    print("\nTop cross-photo similarities (potential same person matches):")
    for sim, f1, f2, p1, p2 in cross_photo_pairs[:12]:
        print(f"  {f1} ({p1}) <-> {f2} ({p2}): Cosine Sim = {sim:.4f} (Cosine Dist = {1 - sim:.4f})")

    print("\nSame-photo pairs (different people in the same photo):")
    for sim, f1, f2, p1, p2 in same_photo_pairs[:6]:
        print(f"  {f1} <-> {f2} in {p1}: Cosine Sim = {sim:.4f} (Cosine Dist = {1 - sim:.4f})")

    print("\n" + "=" * 80)
    print("STEP 5 & 6: CLUSTERING COMPARISON")
    print("=" * 80)

    # 1. Current DBSCAN (eps=0.45, min_samples=2)
    dbscan_045 = DBSCAN(eps=0.45, min_samples=2, metric='cosine').fit(embeddings)
    print(f"\n1. Current DBSCAN (eps=0.45, min_samples=2):")
    print(f"   Labels: {dbscan_045.labels_}")
    print_clusters(all_faces, dbscan_045.labels_)

    # 2. Relaxed DBSCAN (eps=0.55, min_samples=2)
    dbscan_055 = DBSCAN(eps=0.55, min_samples=2, metric='cosine').fit(embeddings)
    print(f"\n2. Relaxed DBSCAN (eps=0.55, min_samples=2):")
    print(f"   Labels: {dbscan_055.labels_}")
    print_clusters(all_faces, dbscan_055.labels_)

    # 3. Agglomerative (average linkage, distance_threshold=0.55)
    # Cosine distance = 1 - cosine_similarity
    agg_055 = AgglomerativeClustering(
        n_clusters=None,
        metric='cosine',
        linkage='average',
        distance_threshold=0.55
    ).fit(embeddings)
    print(f"\n3. Agglomerative (linkage='average', distance_threshold=0.55, sim>=0.45):")
    print(f"   Labels: {agg_055.labels_}")
    print_clusters(all_faces, agg_055.labels_)

    # 4. Agglomerative (average linkage, distance_threshold=0.60)
    agg_060 = AgglomerativeClustering(
        n_clusters=None,
        metric='cosine',
        linkage='average',
        distance_threshold=0.60
    ).fit(embeddings)
    print(f"\n4. Agglomerative (linkage='average', distance_threshold=0.60, sim>=0.40):")
    print(f"   Labels: {agg_060.labels_}")
    print_clusters(all_faces, agg_060.labels_)

    # 5. HDBSCAN (min_cluster_size=2)
    hdb = HDBSCAN(min_cluster_size=2, metric='cosine').fit(embeddings)
    print(f"\n5. HDBSCAN (min_cluster_size=2):")
    print(f"   Labels: {hdb.labels_}")
    print_clusters(all_faces, hdb.labels_)

def print_clusters(all_faces, labels):
    clusters = {}
    for idx, l in enumerate(labels):
        if l not in clusters:
            clusters[l] = []
        clusters[l].append(all_faces[idx])

    for c_id, members in sorted(clusters.items()):
        label_str = "Noise / Unassigned" if c_id == -1 else f"Person Cluster #{c_id}"
        member_strs = [f"{m['global_id']}({m['photo']})" for m in members]
        print(f"     -> {label_str} ({len(members)} faces): {', '.join(member_strs)}")

if __name__ == "__main__":
    main()
