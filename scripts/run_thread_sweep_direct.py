import os
import sys
import time
import json
import subprocess
import numpy as np

with open('baseline.json', 'r') as f:
    baseline_data = json.load(f)

photos = baseline_data['photos']
print(f"Loaded {len(photos)} photos from baseline.json.")

python_exe = sys.executable
cli_script = os.path.abspath(os.path.join("worker", "face_cli.py"))
faces_dir = os.path.abspath(os.path.join("storage", "faces"))

def run_direct_worker_session(threads, run_idx):
    env = os.environ.copy()
    env['FACE_THREADS'] = str(threads)

    proc = subprocess.Popen(
        [python_exe, cli_script, "worker", "--outputDir", faces_dir, "--threads", str(threads)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        env=env
    )

    # Wait for ready signal
    while True:
        line = proc.stderr.readline()
        if "[FaceWorker Python] Initialized and ready." in line:
            break

    photo_results = []
    zero_face_times = []
    t_total_start = time.perf_counter()

    for p in photos:
        task = {
            "action": "detect",
            "imagePath": p['imagePath'],
            "photoId": p['photoId'],
            "conf": 0.65,
            "minFaceSize": 45
        }
        t0 = time.perf_counter()
        proc.stdin.write(json.dumps(task) + "\n")
        proc.stdin.flush()
        out_line = proc.stdout.readline()
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        resp = json.loads(out_line)
        faces_count = len(resp.get('faces', []))
        photo_results.append({
            "photoId": p['photoId'],
            "facesFound": faces_count,
            "timeMs": elapsed_ms
        })
        if faces_count == 0:
            zero_face_times.append(elapsed_ms)

    t_total_ms = round((time.perf_counter() - t_total_start) * 1000, 2)
    pps = round(len(photos) / (t_total_ms / 1000), 2)

    proc.stdin.write("QUIT\n")
    proc.stdin.flush()
    proc.wait()

    return {
        "runIndex": run_idx,
        "totalTimeMs": t_total_ms,
        "photosPerSec": pps,
        "photos": photo_results,
        "zeroFaceTimesMs": zero_face_times
    }

print("=" * 80)
print("PART 2: FOREGROUND POWERSHELL/DIRECT PYTHON SWEEP (THREADS = 2, 4, 6)")
print("=" * 80)

direct_results = []
for th in [2, 4, 6]:
    print(f"\n>>> Direct Python: FACE_THREADS = {th} (3 runs)...")
    runs = []
    for r in range(1, 4):
        res = run_direct_worker_session(th, r)
        runs.append(res)
        z_med = np.median(res['zeroFaceTimesMs']) if res['zeroFaceTimesMs'] else 0
        print(f"  Run {r}/3: Total: {res['totalTimeMs']/1000:.2f}s | Speed: {res['photosPerSec']} pps | 0-face med: {z_med:.1f}ms")

    all_times_sec = [p['timeMs']/1000 for run in runs for p in run['photos']]
    all_zero_times = [t for run in runs for t in run['zeroFaceTimesMs']]
    run_speeds = [r['photosPerSec'] for r in runs]

    stats = {
        "medianSecPerPhoto": round(float(np.median(all_times_sec)), 2),
        "avgSecPerPhoto": round(float(np.mean(all_times_sec)), 2),
        "minSecPerPhoto": round(float(np.min(all_times_sec)), 2),
        "maxSecPerPhoto": round(float(np.max(all_times_sec)), 2),
        "medianPhotosPerSec": round(float(np.median(run_speeds)), 2),
        "minPhotosPerSec": round(float(np.min(run_speeds)), 2),
        "maxPhotosPerSec": round(float(np.max(run_speeds)), 2),
        "zeroFaceMedianMs": round(float(np.median(all_zero_times)), 2),
        "zeroFaceMinMs": round(float(np.min(all_zero_times)), 2),
        "zeroFaceMaxMs": round(float(np.max(all_zero_times)), 2)
    }

    # Sort runs to find median run
    sorted_runs = sorted(runs, key=lambda x: x['totalTimeMs'])
    direct_results.append({
        "threads": th,
        "runs": runs,
        "medianRun": sorted_runs[1],
        "stats": stats
    })

with open('thread_sweep_direct_results.json', 'w') as f:
    json.dump(direct_results, f, indent=2)

print("\nSaved direct sweep results to thread_sweep_direct_results.json")
