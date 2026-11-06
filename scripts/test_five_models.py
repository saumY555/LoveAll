import os
import sys
import time
import json
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

# Load baseline.json
with open('baseline.json', 'r') as f:
    baseline = json.load(f)

photos = baseline['photos']

# Test with allowed_modules=None (ALL 5 models)
so = ort.SessionOptions()
so.intra_op_num_threads = 6
so.inter_op_num_threads = 1
so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'], sess_options=so)
app.prepare(ctx_id=0, det_size=(640, 640))

five_model_results = []
min_cosine_sim = 1.0

for p_idx, p in enumerate(photos):
    img_path = p['imagePath']
    img_bgr = cv2.imread(img_path)
    h, w = img_bgr.shape[:2]

    t0 = time.perf_counter()
    raw_faces = app.get(img_bgr)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    valid_faces = []
    for f in raw_faces:
        bbox = f.bbox.astype(int)
        fw = bbox[2] - bbox[0]
        fh = bbox[3] - bbox[1]
        score = float(f.det_score)
        if score < 0.65 or min(fw, fh) < 45:
            continue
        emb = f.embedding
        norm = np.linalg.norm(emb)
        if norm > 0: emb = emb / norm
        valid_faces.append({
            'bbox': {'x': round(bbox[0]/w, 4), 'y': round(bbox[1]/h, 4), 'width': round(fw/w, 4), 'height': round(fh/h, 4)},
            'confidence': round(score, 4),
            'embedding': [round(float(v), 6) for v in emb]
        })

    five_model_results.append({
        'photoId': p['photoId'],
        'timeMs': round(elapsed_ms, 2),
        'facesFound': len(valid_faces),
        'faces': valid_faces
    })

    # Compare with baseline faces for this photo
    b_faces = p['faces']
    for vf in valid_faces:
        # Match by bbox IoU or closest center
        for bf in b_faces:
            # Cosine similarity
            e1 = np.array(vf['embedding'])
            e2 = np.array(bf['embedding'])
            cos_sim = float(np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2)))
            # If same face (cos_sim > 0.8)
            if cos_sim > 0.8:
                if cos_sim < min_cosine_sim:
                    min_cosine_sim = cos_sim

    print(f"[{p_idx+1:2d}/20] All 5 models: {elapsed_ms:6.1f} ms | Faces: {len(valid_faces):2d} (Baseline: {p['timeMs']:6.1f} ms, Faces: {p['facesFound']:2d})", flush=True)

print(f"\nMinimum Cosine Similarity across matched faces: {min_cosine_sim:.8f}")
with open('five_models_comparison.json', 'w') as f:
    json.dump({'minCosineSimilarity': min_cosine_sim, 'photos': five_model_results}, f, indent=2)
