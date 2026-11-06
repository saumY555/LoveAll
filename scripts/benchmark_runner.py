import os
import sys
import time
import json
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.app.common import Face

def run_benchmark(items):
    intra_threads = int(os.environ.get('FACE_THREADS', '6'))
    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = intra_threads
    sess_opts.inter_op_num_threads = 1
    sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    # 1. Model initialization
    t_m0 = time.perf_counter()
    app = FaceAnalysis(
        name='buffalo_l',
        providers=['CPUExecutionProvider'],
        allowed_modules=['detection', 'recognition'],
        sess_options=sess_opts
    )
    app.prepare(ctx_id=0, det_size=(640, 640))

    # Verify session options
    for mod_name, model in app.models.items():
        current_intra = model.session.get_session_options().intra_op_num_threads
        if current_intra != intra_threads:
            model_path = getattr(model, 'model_file', None) or getattr(model.session, '_model_path', None)
            if model_path:
                model.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=['CPUExecutionProvider'])

    t_model_load_ms = (time.perf_counter() - t_m0) * 1000

    det_model = app.models['detection']
    rec_model = app.models['recognition']

    photos_metrics = []
    total_faces = 0

    t_total_start = time.perf_counter()

    for item in items:
        img_path = item['imagePath']
        photo_id = item.get('photoId', os.path.basename(img_path))

        t_p0 = time.perf_counter()

        # Stage 1: File read
        t_r0 = time.perf_counter()
        with open(img_path, 'rb') as f:
            raw_bytes = f.read()
        t_file_read_ms = (time.perf_counter() - t_r0) * 1000

        # Stage 2: JPEG decode
        t_d0 = time.perf_counter()
        buf = np.frombuffer(raw_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        t_jpeg_decode_ms = (time.perf_counter() - t_d0) * 1000

        if img_bgr is None:
            continue

        h, w = img_bgr.shape[:2]

        # Stage 3: Resize (if any)
        t_res0 = time.perf_counter()
        t_resize_ms = (time.perf_counter() - t_res0) * 1000

        # Stage 4: Detection (SCRFD at 640x640)
        t_det0 = time.perf_counter()
        bboxes, kpss = det_model.detect(img_bgr, max_num=0, metric='default')
        t_detection_ms = (time.perf_counter() - t_det0) * 1000

        # Stage 5: Embedding (ArcFace 512-d) per face
        face_count = 0
        embeddings_ms = []

        if bboxes is not None and len(bboxes) > 0:
            for i in range(len(bboxes)):
                score = float(bboxes[i, 4])
                bbox = bboxes[i, :4].astype(int)
                fw = int(bbox[2] - bbox[0])
                fh = int(bbox[3] - bbox[1])
                if score < 0.65 or min(fw, fh) < 45:
                    continue

                face_count += 1
                kps = kpss[i] if kpss is not None else None
                face_obj = Face(bbox=bbox, kps=kps, det_score=score)

                t_e0 = time.perf_counter()
                rec_model.get(img_bgr, face_obj)
                emb = face_obj.embedding
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                e_ms = (time.perf_counter() - t_e0) * 1000
                embeddings_ms.append(e_ms)

        t_embed_photo_ms = sum(embeddings_ms)
        t_embed_per_face_avg = (t_embed_photo_ms / face_count) if face_count > 0 else 0.0
        t_photo_total_ms = (time.perf_counter() - t_p0) * 1000
        total_faces += face_count

        photos_metrics.append({
            'photoId': photo_id,
            'dimensions': {'width': w, 'height': h},
            'facesFound': face_count,
            'timing': {
                'fileReadMs': round(t_file_read_ms, 2),
                'jpegDecodeMs': round(t_jpeg_decode_ms, 2),
                'resizeMs': round(t_resize_ms, 2),
                'detectionMs': round(t_detection_ms, 2),
                'embeddingTotalMs': round(t_embed_photo_ms, 2),
                'embeddingPerFaceMs': round(t_embed_per_face_avg, 2),
                'totalMs': round(t_photo_total_ms, 2)
            }
        })

    t_total_elapsed_ms = (time.perf_counter() - t_total_start) * 1000

    return {
        'totalTimeMs': round(t_total_elapsed_ms, 2),
        'modelLoadMs': round(t_model_load_ms, 2),
        'photosCount': len(photos_metrics),
        'totalFaces': total_faces,
        'photos': photos_metrics
    }

def main():
    raw_input = sys.stdin.read().strip().lstrip('\ufeff')
    items = json.loads(raw_input)
    result = run_benchmark(items)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
