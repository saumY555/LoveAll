import ctypes
import sys

k32 = ctypes.windll.kernel32
k32.GetCurrentProcess.restype = ctypes.c_void_p
handle = k32.GetCurrentProcess()

class PROCESS_POWER_THROTTLING_STATE(ctypes.Structure):
    _fields_ = [
        ("Version", ctypes.c_ulong),
        ("ControlMask", ctypes.c_ulong),
        ("StateMask", ctypes.c_ulong),
    ]

state = PROCESS_POWER_THROTTLING_STATE()
state.Version = 1

k32.GetProcessInformation.restype = ctypes.c_int
k32.GetProcessInformation.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t]
k32.GetPriorityClass.argtypes = [ctypes.c_void_p]
k32.GetPriorityClass.restype = ctypes.c_ulong

res = k32.GetProcessInformation(handle, 4, ctypes.byref(state), ctypes.sizeof(state))
err = k32.GetLastError() if not res else 0

priority_class = k32.GetPriorityClass(handle)

print(f"GetProcessInformation result: {res}, error: {err}")
print(f"ControlMask: {hex(state.ControlMask)}, StateMask: {hex(state.StateMask)}")
print(f"PriorityClass: {hex(priority_class)}")
