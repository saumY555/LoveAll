import cProfile
import pstats
import io
import cv2
import onnxruntime as ort
from insightface.app import FaceAnalysis

IMG_PATH = "storage/originals/44e073375e90c161e415ec755811145b3544ff49f52066afe778ddee749ca262.jpg"

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))

img = cv2.imread(IMG_PATH)

# Warmup
app.get(img)

# Profile one call to app.get(img)
pr = cProfile.Profile()
pr.enable()
faces = app.get(img)
pr.disable()

s = io.StringIO()
ps = pstats.Stats(pr, stream=s).sort_stats('tottime')
ps.print_stats(35)
print(s.getvalue())
