import os
import sys
from PIL import Image
import numpy as np

sys.path.append(os.path.join(os.getcwd(), 'worker'))
from face_engine import FaceEngine

test_dir = os.path.join(os.getcwd(), 'test_photos')
det_model = os.path.join(os.getcwd(), 'models', 'version-RFB-320.onnx')
rec_model = os.path.join(os.getcwd(), 'models', 'w600k_mbf.onnx')

engine = FaceEngine(det_model, rec_model)

photos = [f for f in os.listdir(test_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
print(f"=== DEBUGGING CURRENT PIPELINE (UltraFace 320x240, conf=0.65, DBSCAN eps=0.45) ===")
print(f"Test folder: {test_dir} ({len(photos)} photos)\n")

for photo in sorted(photos):
    p_path = os.path.join(test_dir, photo)
    img = Image.open(p_path)
    orig_w, orig_h = img.size

    # Replicate detect_and_embed step by step to log filter reasons
    resized = img.resize((320, 240), Image.BILINEAR).convert('RGB')
    arr = np.array(resized, dtype=np.float32)
    arr = (arr - 127.0) / 128.0
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, 0)

    input_name = engine.detector.get_inputs()[0].name
    scores, boxes = engine.detector.run(None, {input_name: arr})
    scores = scores[0]
    boxes = boxes[0]

    center_variance = 0.1
    size_variance = 0.2
    boxes_c = boxes * np.array([center_variance, center_variance, size_variance, size_variance])
    boxes_c[:, :2] = boxes_c[:, :2] * engine.priors[:, 2:] + engine.priors[:, :2]
    boxes_c[:, 2:] = np.exp(boxes_c[:, 2:]) * engine.priors[:, 2:]

    boxes_final = np.zeros_like(boxes_c)
    boxes_final[:, :2] = boxes_c[:, :2] - boxes_c[:, 2:] / 2
    boxes_final[:, 2:] = boxes_c[:, :2] + boxes_c[:, 2:] / 2
    boxes_final = np.clip(boxes_final, 0.0, 1.0)

    face_scores = scores[:, 1]
    
    # Check top raw detections before filtering
    top_indices = np.argsort(face_scores)[::-1][:5]
    
    print(f"Photo: {photo} (Resolution: {orig_w}x{orig_h})")
    print(f"  Top 5 raw detection confidence scores: {[round(float(face_scores[i]), 4) for i in top_indices]}")
    
    # Run engine detect_and_embed
    faces = engine.detect_and_embed(p_path, output_faces_dir='storage/faces_debug', conf_threshold=0.65, photo_id=photo)
    print(f"  Faces passing threshold (conf >= 0.65): {len(faces)}")
    for i, f in enumerate(faces):
        bw_px = int(f['boundingBox']['width'] * orig_w)
        bh_px = int(f['boundingBox']['height'] * orig_h)
        print(f"    Face #{i+1}: Conf={f['confidence']}, BBox=[{bw_px}px x {bh_px}px] (norm: {f['boundingBox']})")
    print()
