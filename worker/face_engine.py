import os
import sys
import json
import cv2
import numpy as np
from PIL import Image
import onnxruntime as ort
from insightface.app import FaceAnalysis
from sklearn.cluster import AgglomerativeClustering

class FaceEngine:
    def __init__(
        self,
        model_name="buffalo_l",
        det_size=(640, 640),
        providers=None,
        intra_threads=None
    ):
        if providers is None:
            providers = ['CPUExecutionProvider']

        # Read intra_threads from FACE_THREADS env var if not explicitly passed (default: 6)
        if intra_threads is None:
            try:
                intra_threads = int(os.environ.get('FACE_THREADS', '6'))
            except ValueError:
                intra_threads = 6

        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = intra_threads
        sess_opts.inter_op_num_threads = 1
        sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        # Load only detection and recognition modules (omits heavy unused 106-point mesh & gender/age models)
        self.app = FaceAnalysis(
            name=model_name,
            providers=providers,
            allowed_modules=['detection', 'recognition'],
            sess_options=sess_opts
        )
        self.app.prepare(ctx_id=0, det_size=det_size)

        # Verify and rebuild session if needed as fallback; record effective thread values
        effective_threads = {}
        for mod_name, model in self.app.models.items():
            current_intra = model.session.get_session_options().intra_op_num_threads
            if current_intra != intra_threads:
                model_path = getattr(model, 'model_file', None) or getattr(model.session, '_model_path', None)
                if model_path:
                    model.session = ort.InferenceSession(model_path, sess_options=sess_opts, providers=providers)
            effective_threads[mod_name] = model.session.get_session_options().intra_op_num_threads

        # Log provider and EFFECTIVE thread count read back from the ONNX sessions (to stderr)
        sys.stderr.write(
            f"[FaceEngine] Initialized: providers={providers}, effective_intra_threads={effective_threads}, inter_threads=1, allowed_modules=['detection', 'recognition']\n"
        )
        sys.stderr.flush()

    def detect_and_embed_single(
        self,
        img_bgr,
        photo_id: str,
        output_faces_dir: str,
        conf_threshold: float = 0.65,
        min_face_size: int = 45
    ):
        orig_h, orig_w = img_bgr.shape[:2]
        raw_faces = self.app.get(img_bgr)
        detected_faces = []

        face_idx = 0
        for f in raw_faces:
            bbox = f.bbox.astype(int)
            fw = int(bbox[2] - bbox[0])
            fh = int(bbox[3] - bbox[1])
            score = float(f.det_score)

            # Filter out low-confidence faces and tiny background passerby faces
            if score < conf_threshold:
                continue
            if min(fw, fh) < min_face_size:
                continue

            # Normalize embedding (512-d unit vector)
            emb = f.embedding
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            emb_list = [round(float(v), 6) for v in emb]

            # Generate face thumbnail with 20% margin
            margin_x = int(fw * 0.20)
            margin_y = int(fh * 0.20)
            crop_x1 = max(0, bbox[0] - margin_x)
            crop_y1 = max(0, bbox[1] - margin_y)
            crop_x2 = min(orig_w, bbox[2] + margin_x)
            crop_y2 = min(orig_h, bbox[3] + margin_y)

            face_crop_bgr = img_bgr[crop_y1:crop_y2, crop_x1:crop_x2]
            thumb_filename = f"face_{photo_id}_{face_idx}.webp"
            if face_crop_bgr.size > 0:
                face_crop_rgb = cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2RGB)
                pil_crop = Image.fromarray(face_crop_rgb)
                thumb = pil_crop.resize((160, 160), Image.LANCZOS)
                thumb_path = os.path.join(output_faces_dir, thumb_filename)
                thumb.save(thumb_path, "WEBP", quality=85)

            # Normalized bounding box relative to original dimensions
            rel_x = round(float(bbox[0]) / orig_w, 4)
            rel_y = round(float(bbox[1]) / orig_h, 4)
            rel_w = round(float(fw) / orig_w, 4)
            rel_h = round(float(fh) / orig_h, 4)

            detected_faces.append({
                "boundingBox": {
                    "x": max(0.0, min(1.0, rel_x)),
                    "y": max(0.0, min(1.0, rel_y)),
                    "width": max(0.0, min(1.0, rel_w)),
                    "height": max(0.0, min(1.0, rel_h)),
                },
                "confidence": round(score, 4),
                "embedding": emb_list,
                "thumbnailFilename": thumb_filename,
            })
            face_idx += 1

        return detected_faces

    def detect_and_embed(
        self,
        image_path: str,
        output_faces_dir: str,
        conf_threshold: float = 0.65,
        photo_id: str = "",
        min_face_size: int = 45
    ):
        """Detect and embed faces for a single photo."""
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        os.makedirs(output_faces_dir, exist_ok=True)
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            raise ValueError(f"Failed to read image at: {image_path}")

        return self.detect_and_embed_single(
            img_bgr,
            photo_id=photo_id,
            output_faces_dir=output_faces_dir,
            conf_threshold=conf_threshold,
            min_face_size=min_face_size
        )

    def detect_and_embed_batch(
        self,
        items,
        output_faces_dir: str,
        conf_threshold: float = 0.65,
        min_face_size: int = 45
    ):
        """
        Process multiple photos in a single model session for maximum speed.
        items: list of dicts [{'photoId': str, 'imagePath': str}]
        """
        os.makedirs(output_faces_dir, exist_ok=True)
        results = {}

        for item in items:
            p_id = item["photoId"]
            img_path = item["imagePath"]
            try:
                if not os.path.exists(img_path):
                    results[p_id] = {"error": f"Image not found: {img_path}", "faces": []}
                    continue
                img_bgr = cv2.imread(img_path)
                if img_bgr is None:
                    results[p_id] = {"error": f"Failed to read image: {img_path}", "faces": []}
                    continue
                faces = self.detect_and_embed_single(
                    img_bgr,
                    photo_id=p_id,
                    output_faces_dir=output_faces_dir,
                    conf_threshold=conf_threshold,
                    min_face_size=min_face_size
                )
                results[p_id] = {"faces": faces}
            except Exception as e:
                results[p_id] = {"error": str(e), "faces": []}

        return results

    @staticmethod
    def cluster_faces(faces_data, eps=0.50, min_samples=2):
        """
        Cluster face embeddings using AgglomerativeClustering (average linkage)
        with cosine distance.
        eps: cosine distance threshold (default: 0.50, equivalent to cosine similarity >= 0.50).
        min_samples: minimum faces required to form a cluster (default: 2).
        """
        if not faces_data:
            return {"clusters": [], "noiseFaceIds": []}

        if len(faces_data) == 1:
            if min_samples <= 1:
                return {
                    "clusters": [{
                        "clusterIndex": 0,
                        "faceIds": [faces_data[0]["id"]],
                        "representativeFaceId": faces_data[0]["id"]
                    }],
                    "noiseFaceIds": []
                }
            else:
                return {
                    "clusters": [],
                    "noiseFaceIds": [faces_data[0]["id"]]
                }

        embeddings = np.array([f["embedding"] for f in faces_data], dtype=np.float32)
        # Ensure normalized
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        embeddings = embeddings / norms

        face_ids = [f["id"] for f in faces_data]

        clustering = AgglomerativeClustering(
            n_clusters=None,
            metric='cosine',
            linkage='average',
            distance_threshold=eps
        ).fit(embeddings)

        labels = clustering.labels_

        clusters_dict = {}
        for idx, label in enumerate(labels):
            if label not in clusters_dict:
                clusters_dict[label] = []
            clusters_dict[label].append(faces_data[idx])

        clusters_output = []
        noise_ids = []

        cluster_counter = 0
        for raw_label, group in sorted(clusters_dict.items()):
            if len(group) < min_samples:
                for f in group:
                    noise_ids.append(f["id"])
            else:
                g_embeddings = np.array([f["embedding"] for f in group], dtype=np.float32)
                centroid = np.mean(g_embeddings, axis=0)
                centroid_norm = np.linalg.norm(centroid)
                if centroid_norm > 0:
                    centroid = centroid / centroid_norm

                sims = np.dot(g_embeddings, centroid)
                best_idx = int(np.argmax(sims))
                rep_id = group[best_idx]["id"]

                clusters_output.append({
                    "clusterIndex": cluster_counter,
                    "faceIds": [f["id"] for f in group],
                    "representativeFaceId": rep_id
                })
                cluster_counter += 1

        return {
            "clusters": clusters_output,
            "noiseFaceIds": noise_ids
        }
