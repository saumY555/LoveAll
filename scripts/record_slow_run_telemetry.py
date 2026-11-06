import os
import sys
import time
import json
import ctypes
import threading
import subprocess

# Load baseline photos
with open('baseline.json', 'r') as f:
    baseline_data = json.load(f)
photos = baseline_data['photos']

python_exe = sys.executable
cli_script = os.path.abspath(os.path.join("worker", "face_cli.py"))
faces_dir = os.path.abspath(os.path.join("storage", "faces"))

# Windows API for power throttling & priority
k32 = ctypes.windll.kernel32
k32.OpenProcess.restype = ctypes.c_void_p
k32.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
k32.CloseHandle.argtypes = [ctypes.c_void_p]

k32.GetProcessInformation.restype = ctypes.c_int
k32.GetProcessInformation.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t]
k32.GetPriorityClass.argtypes = [ctypes.c_void_p]
k32.GetPriorityClass.restype = ctypes.c_ulong

class PROCESS_POWER_THROTTLING_STATE(ctypes.Structure):
    _fields_ = [
        ("Version", ctypes.c_ulong),
        ("ControlMask", ctypes.c_ulong),
        ("StateMask", ctypes.c_ulong),
    ]

# Start slow worker run (THREADS=6)
env = os.environ.copy()
env['FACE_THREADS'] = '6'

proc = subprocess.Popen(
    [python_exe, cli_script, "worker", "--outputDir", faces_dir, "--threads", "6"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1,
    env=env
)

proc_handle = k32.OpenProcess(0x1000, False, proc.pid)

while True:
    line = proc.stderr.readline()
    if "[FaceWorker Python] Initialized and ready." in line:
        break

print(f"[Telemetry] Child Python PID = {proc.pid}")

telemetry_samples = []
stop_flag = threading.Event()

# Efficient single-instance continuous PowerShell counter stream
ps_script = (
    "$ErrorActionPreference = 'SilentlyContinue'; "
    "while ($true) { "
    "  $info = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ProcessorInformation | "
    "          Select-Object Name, PercentProcessorPerformance, PercentProcessorUtility, ProcessorFrequency; "
    "  $json = $info | ConvertTo-Json -Compress; "
    "  [Console]::Out.WriteLine($json); "
    "  [Console]::Out.Flush(); "
    "  Start-Sleep -Seconds 1; "
    "}"
)

ps_proc = subprocess.Popen(
    ["powershell", "-NoProfile", "-Command", ps_script],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

def monitor_stream():
    t_start = time.perf_counter()
    while not stop_flag.is_set():
        line = ps_proc.stdout.readline()
        if not line:
            break
        s_time = round(time.perf_counter() - t_start, 2)
        
        # Check Power Throttling & Priority
        state = PROCESS_POWER_THROTTLING_STATE()
        state.Version = 1
        res = k32.GetProcessInformation(proc_handle, 4, ctypes.byref(state), ctypes.sizeof(state))
        priority = k32.GetPriorityClass(proc_handle)
        is_eco = bool(state.StateMask & 1) if res else False

        cores_data = []
        try:
            parsed = json.loads(line.strip())
            if isinstance(parsed, list):
                for item in parsed:
                    cores_data.append({
                        "name": item.get("Name"),
                        "perfPct": item.get("PercentProcessorPerformance"),
                        "utilityPct": item.get("PercentProcessorUtility"),
                        "freqMHz": item.get("ProcessorFrequency")
                    })
        except Exception:
            pass

        telemetry_samples.append({
            "elapsedSec": s_time,
            "powerThrottlingStateMask": hex(state.StateMask) if res else "N/A",
            "isEcoQoS": is_eco,
            "priorityClass": hex(priority),
            "cores": cores_data
        })

sampler_thread = threading.Thread(target=monitor_stream, daemon=True)
sampler_thread.start()

photo_timings = []
t0_run = time.perf_counter()

for i, p in enumerate(photos):
    task = {
        "action": "detect",
        "imagePath": p['imagePath'],
        "photoId": p['photoId'],
        "conf": 0.65,
        "minFaceSize": 45
    }
    t0_photo = time.perf_counter()
    proc.stdin.write(json.dumps(task) + "\n")
    proc.stdin.flush()
    out = proc.stdout.readline()
    t_photo_ms = round((time.perf_counter() - t0_photo) * 1000, 2)
    resp = json.loads(out)
    faces_n = len(resp.get('faces', []))
    photo_timings.append({
        "photoId": p['photoId'],
        "faces": faces_n,
        "timeMs": t_photo_ms
    })
    print(f"  Photo {i+1:2d}/20 | Faces: {faces_n:2d} | Time: {t_photo_ms:6.1f} ms", flush=True)

stop_flag.set()
ps_proc.terminate()
try:
    ps_proc.wait(timeout=2)
except Exception:
    ps_proc.kill()

proc.stdin.write("QUIT\n")
proc.stdin.flush()
proc.wait()
k32.CloseHandle(proc_handle)

t_run_total_sec = round(time.perf_counter() - t0_run, 2)
print(f"[Telemetry] Run completed in {t_run_total_sec} s. Samples collected: {len(telemetry_samples)}")

with open('telemetry_slow_run.json', 'w') as f:
    json.dump({
        "totalRunSec": t_run_total_sec,
        "samplesCount": len(telemetry_samples),
        "photoTimings": photo_timings,
        "samples": telemetry_samples
    }, f, indent=2)

print("[Telemetry] Saved to telemetry_slow_run.json")
