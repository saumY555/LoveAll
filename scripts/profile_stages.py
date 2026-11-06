import os
import sys
import time
import json
import cv2
import numpy as np
from PIL import Image
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face
from sklearn.cluster import AgglomerativeClustering

def main():
    raw_input = sys.stdin.read()
    items = json.loads(raw_input)

    intra_threads = int(os.environ.get('FACE_THREADS', '6'))
    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = intra_threads
    sess_opts.inter_op_num_threads = 1
    sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    # 1. Model Load & Init
    t0 = time.time()
    app = FaceAnalysis(
        name='buffalo_l',
        providers=['CPUExecutionProvider'],
        allowed_modules=['detection', 'recognition'],
        sess_options=sess_opts
    )
    app.prepare(ctx_id=0, det_size=(640, 640))

    effective_threads = {}
    for mod_name, model in app.models.items():
        current_intra = model.session.get_session_options().intra_op_num_threads
        if current_intra != intra_threads:
            model_path = getattr(model, 'model_file', None) or getattr(model.session, '_model_path', None)
            if model_path:
                model.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=['CPUExecutionProvider'])
        effective_threads[mod_name] = model.session.get_session_options().intra_op_num_threads

    sys.stderr.write(
        f"[profile_stages] providers=['CPUExecutionProvider'], effective_intra_threads={effective_threads}, inter_threads=1, allowed_modules=['detection', 'recognition']\n"
    )
    sys.stderr.flush()

    t_model_load = (time.time() - t0) * 1000

    det_model = app.models['detection']
    rec_model = app.models['recognition']

    t_decode_total = 0.0
    t_detect_total = 0.0
    t_embed_total = 0.0
    t_crop_total = 0.0

    output_faces_dir = 'storage/faces'
    os.makedirs(output_faces_dir, exist_ok=True)

    results = {}
    all_embeddings = []

    for item in items:
        p_id = item["photoId"]
        img_path = item["imagePath"]

        # Stage 2: Decode image
        t_d0 = time.time()
        img_bgr = cv2.imread(img_path)
        t_decode_total += (time.time() - t_d0) * 1000

        if img_bgr is None:
            results[p_id] = {"faces": []}
            continue

        orig_h, orig_w = img_bgr.shape[:2]

        # Stage 3: Face Detection (Scrfd)
        t_det0 = time.time()
        bboxes, kpss = det_model.detect(img_bgr, max_num=0, metric='default')
        t_detect_total += (time.time() - t_det0) * 1000

        detected_faces = []
        if bboxes is not None and len(bboxes) > 0:
            for i in range(len(bboxes)):
                bbox = bboxes[i, :4].astype(int)
                score = float(bboxes[i, 4])
                kps = kpss[i] if kpss is not None else None

                fw = int(bbox[2] - bbox[0])
                fh = int(bbox[3] - bbox[1])

                if score < 0.65 or min(fw, fh) < 45:
                    continue

                # Stage 4: Feature Embedding (ArcFace)
                t_em0 = time.time()
                # Use recognizer get
                dummy_face = Face(bbox=bbox, kps=kps, det_score=score)
                rec_model.get(img_bgr, dummy_face)
                emb = dummy_face.embedding
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                t_embed_total += (time.time() - t_em0) * 1000

                all_embeddings.append(emb)

                # Stage 5: Face Crop Thumbnail Save
                t_cr0 = time.time()
                margin_x = int(fw * 0.20)
                margin_y = int(fh * 0.20)
                crop_x1 = max(0, bbox[0] - margin_x)
                crop_y1 = max(0, bbox[1] - margin_y)
                crop_x2 = min(orig_w, bbox[2] + margin_x)
                crop_y2 = min(orig_h, bbox[3] + margin_y)

                face_crop_bgr = img_bgr[crop_y1:crop_y2, crop_x1:crop_x2]
                thumb_filename = f"face_{p_id}_{i}.webp"
                if face_crop_bgr.size > 0:
                    face_crop_rgb = cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2RGB)
                    pil_crop = Image.fromarray(face_crop_rgb)
                    thumb = pil_crop.resize((160, 160), Image.LANCZOS)
                    thumb.save(os.path.join(output_faces_dir, thumb_filename), "WEBP", quality=85)
                t_crop_total += (time.time() - t_cr0) * 1000

                detected_faces.append({
                    "boundingBox": {
                        "x": round(float(bbox[0]) / orig_w, 4),
                        "y": round(float(bbox[1]) / orig_h, 4),
                        "width": round(float(fw) / orig_w, 4),
                        "height": round(float(fh) / orig_h, 4),
                    },
                    "confidence": round(score, 4),
                    "embedding": [round(float(v), 5) for v in emb],
                    "thumbnailFilename": thumb_filename
                })

        results[p_id] = {"faces": detected_faces}

    # Stage 6: In-memory clustering
    t_cl0 = time.time()
    people_count = 0
    if len(all_embeddings) >= 2:
        embs = np.array(all_embeddings)
        agg = AgglomerativeClustering(n_clusters=None, metric='cosine', linkage='average', distance_threshold=0.50).fit(embs)
        people_count = len(set(agg.labels_))
    t_clustering = (time.time() - t_cl0) * 1000

    # Stage 7: Result Transfer / Serialization
    t_tr0 = time.time()
    payload = json.dumps({
        "results": results,
        "total_faces": len(all_embeddings),
        "people_count": people_count,
        "timings": {
            "model_load_ms": round(t_model_load, 1),
            "image_decode_ms": round(t_decode_total, 1),
            "detection_ms": round(t_detect_total, 1),
            "embedding_ms": round(t_embed_total, 1),
            "crop_save_ms": round(t_crop_total, 1),
            "clustering_ms": round(t_clustering, 1),
            "transfer_ms": 0.0
        }
    })
    t_transfer = (time.time() - t_tr0) * 1000
    # Update transfer_ms in payload
    print(payload)

if __name__ == '__main__':
    main()
