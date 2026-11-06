import os
import sys
import time
import glob
import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from insightface.utils import face_align

def find_test_photos(count=5):
    candidates = sorted(glob.glob('test_photos/*.jpg') + glob.glob('test_photos/*.jpeg'))
    if len(candidates) < count:
        candidates += sorted(glob.glob('storage/originals/*.jpg') + glob.glob('storage/originals/*.jpeg'))
    
    # Pick photos that actually contain at least 1 detectable face
    # Quick detection using a light session
    temp_app = FaceAnalysis(name='buffalo_l', allowed_modules=['detection'])
    temp_app.prepare(ctx_id=0, det_size=(640, 640))
    
    valid_photos = []
    for p in candidates:
        img = cv2.imread(p)
        if img is None:
            continue
        bboxes, kpss = temp_app.models['detection'].detect(img, max_num=0, metric='default')
        if bboxes is not None and len(bboxes) > 0:
            valid_photos.append((p, img, bboxes[0], kpss[0]))
            if len(valid_photos) == count:
                break
    return valid_photos

def create_face_analysis(intra_threads=None, inter_threads=1, allowed_modules=None):
    if allowed_modules is None:
        allowed_modules = ['detection', 'recognition']
        
    app = FaceAnalysis(
        name='buffalo_l',
        providers=['CPUExecutionProvider'],
        allowed_modules=allowed_modules
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    
    # If thread count specified, adjust session options for each model session
    if intra_threads is not None:
        for mod_name, model in app.models.items():
            if hasattr(model, 'session') and model.session is not None:
                # To change thread count in ONNX Runtime, we re-initialize session with custom options
                model_path = model.session._model_path if hasattr(model.session, '_model_path') else None
                if not model_path and hasattr(model, 'model_file'):
                    model_path = model.model_file
                if model_path:
                    sess_opts = ort.SessionOptions()
                    sess_opts.intra_op_num_threads = intra_threads
                    sess_opts.inter_op_num_threads = inter_threads
                    sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
                    model.session = ort.InferenceSession(
                        model_path,
                        sess_options=sess_opts,
                        providers=['CPUExecutionProvider']
                    )
    return app

def benchmark_single_config(app, photos_data, repeats=20):
    det_model = app.models['detection']
    rec_model = app.models.get('recognition')
    
    # 1. Warmup (3 passes on each of the 5 photos)
    for _ in range(3):
        for path, img, bbox, kps in photos_data:
            det_model.detect(img, max_num=0, metric='default')
            if rec_model:
                from insightface.app.common import Face
                dummy_face = Face(bbox=bbox[:4].astype(int), kps=kps, det_score=float(bbox[4]))
                rec_model.get(img, dummy_face)
                
    # 2. Benchmark Detection (20 repeats across the 5 photos)
    det_times = []
    for _ in range(repeats):
        for path, img, _, _ in photos_data:
            t0 = time.perf_counter()
            det_model.detect(img, max_num=0, metric='default')
            t1 = time.perf_counter()
            det_times.append((t1 - t0) * 1000.0)
            
    # 3. Benchmark Embedding of a Single Face (20 repeats across the 5 face samples)
    emb_times = []
    sub_timings = {
        'norm_crop': [],
        'blob_prep': [],
        'onnx_forward': [],
        'l2_norm': []
    }
    
    if rec_model:
        from insightface.app.common import Face
        for _ in range(repeats):
            for path, img, bbox, kps in photos_data:
                dummy_face = Face(bbox=bbox[:4].astype(int), kps=kps, det_score=float(bbox[4]))
                
                t_total_0 = time.perf_counter()
                
                # Sub-timing: norm_crop
                t_c0 = time.perf_counter()
                aimg = face_align.norm_crop(img, landmark=dummy_face.kps, image_size=rec_model.input_size[0])
                t_c1 = time.perf_counter()
                sub_timings['norm_crop'].append((t_c1 - t_c0) * 1000.0)
                
                # Sub-timing: blob preparation
                t_b0 = time.perf_counter()
                input_size = rec_model.input_size
                blob = cv2.dnn.blobFromImages([aimg], 1.0 / rec_model.input_std, input_size,
                                              (rec_model.input_mean, rec_model.input_mean, rec_model.input_mean), swapRB=True)
                blob = rec_model._coerce_input_blob(blob)
                t_b1 = time.perf_counter()
                sub_timings['blob_prep'].append((t_b1 - t_b0) * 1000.0)
                
                # Sub-timing: ONNX forward pass
                t_f0 = time.perf_counter()
                net_out = rec_model.session.run(rec_model.output_names, {rec_model.input_name: blob})[0]
                t_f1 = time.perf_counter()
                sub_timings['onnx_forward'].append((t_f1 - t_f0) * 1000.0)
                
                # Sub-timing: L2 norm
                t_n0 = time.perf_counter()
                feat = net_out.flatten()
                norm = np.linalg.norm(feat)
                if norm > 0:
                    feat = feat / norm
                t_n1 = time.perf_counter()
                sub_timings['l2_norm'].append((t_n1 - t_n0) * 1000.0)
                
                t_total_1 = time.perf_counter()
                emb_times.append((t_total_1 - t_total_0) * 1000.0)
                
    return {
        'det_mean_ms': np.mean(det_times),
        'det_min_ms': np.min(det_times),
        'det_p50_ms': np.median(det_times),
        'emb_mean_ms': np.mean(emb_times) if emb_times else 0,
        'emb_min_ms': np.min(emb_times) if emb_times else 0,
        'emb_p50_ms': np.median(emb_times) if emb_times else 0,
        'sub_timings': {k: (np.mean(v), np.min(v)) for k, v in sub_timings.items()}
    }

def main():
    print("=" * 80)
    print("FINDING 5 TEST PHOTOS WITH DETECTABLE FACES...")
    photos_data = find_test_photos(5)
    print(f"Loaded {len(photos_data)} test photos:")
    for i, (path, img, bbox, _) in enumerate(photos_data):
        print(f"  [{i+1}] {path} ({img.shape[1]}x{img.shape[0]}, face score: {bbox[4]:.2f})")
        
    print("\n" + "=" * 80)
    print("BENCHMARK 1: DEFAULT THREADS (intra=0/default, allowed_modules=['detection', 'recognition'])")
    print("=" * 80)
    app_default = create_face_analysis()
    res_default = benchmark_single_config(app_default, photos_data, repeats=20)
    print(f"Detection (Scrfd 640x640):  mean = {res_default['det_mean_ms']:.2f} ms | min = {res_default['det_min_ms']:.2f} ms")
    print(f"Embedding (ArcFace 112x112): mean = {res_default['emb_mean_ms']:.2f} ms | min = {res_default['emb_min_ms']:.2f} ms")
    print("\nDetailed Embedding Stage Sub-timings (mean / min):")
    for k, (mean_v, min_v) in res_default['sub_timings'].items():
        print(f"  - {k:<15}: mean = {mean_v:.3f} ms | min = {min_v:.3f} ms")
        
    print("\n" + "=" * 80)
    print("BENCHMARK 2: THREAD SWEEP (intra_op_num_threads = 1, 2, 4, 6, 8, 10, inter_op = 1)")
    print("=" * 80)
    thread_counts = [1, 2, 4, 6, 8, 10]
    sweep_results = []
    
    for tc in thread_counts:
        print(f"Testing intra_op_num_threads = {tc} ...", flush=True)
        app_tc = create_face_analysis(intra_threads=tc, inter_threads=1)
        res_tc = benchmark_single_config(app_tc, photos_data, repeats=20)
        sweep_results.append((tc, res_tc))
        
    print("\n" + "-" * 80)
    print(f"{'Intra Threads':<14} | {'Det Mean (ms)':<14} | {'Det Min (ms)':<14} | {'Emb Mean (ms)':<14} | {'Emb Min (ms)':<14}")
    print("-" * 80)
    print(f"{'Default (0)':<14} | {res_default['det_mean_ms']:<14.2f} | {res_default['det_min_ms']:<14.2f} | {res_default['emb_mean_ms']:<14.2f} | {res_default['emb_min_ms']:<14.2f}")
    for tc, r in sweep_results:
        print(f"{tc:<14} | {r['det_mean_ms']:<14.2f} | {r['det_min_ms']:<14.2f} | {r['emb_mean_ms']:<14.2f} | {r['emb_min_ms']:<14.2f}")
    print("-" * 80)
    
    print("\n" + "=" * 80)
    print("BENCHMARK 3: INSIGHTFACE MODULE COMPARISON (all buffalo_l vs restricted)")
    print("=" * 80)
    print("Loading full buffalo_l (all modules)...", flush=True)
    app_all = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app_all.prepare(ctx_id=0, det_size=(640, 640))
    print(f"Full buffalo_l modules loaded: {list(app_all.models.keys())}")
    
    # Test full app.get() on photo 1 with full vs restricted
    test_img = photos_data[0][1]
    
    # Warmup
    app_all.get(test_img)
    app_default.get(test_img)
    
    times_all = []
    times_restricted = []
    for _ in range(10):
        t0 = time.perf_counter()
        app_all.get(test_img)
        times_all.append((time.perf_counter() - t0) * 1000.0)
        
        t0 = time.perf_counter()
        app_default.get(test_img)
        times_restricted.append((time.perf_counter() - t0) * 1000.0)
        
    print(f"Full buffalo_l (all 5 modules) app.get() mean:       {np.mean(times_all):.2f} ms")
    print(f"Restricted (['detection', 'recognition']) app.get() mean: {np.mean(times_restricted):.2f} ms")
    print(f"Speedup from restricting modules:                    {np.mean(times_all) / np.mean(times_restricted):.2f}x")

if __name__ == '__main__':
    main()
