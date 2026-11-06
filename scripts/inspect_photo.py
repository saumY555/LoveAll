import json
import time
import cv2
import onnxruntime as ort
from insightface.app import FaceAnalysis

data = json.load(open('benchmark-results.json'))
photos = data['medianRun']['photos']
print(f"Total photos in benchmark: {len(photos)}")

# Find photo cmw1z98n200r1wdwo9v0b4y1x
target = next((p for p in photos if p['photoId'] == 'cmw1z98n200r1wdwo9v0b4y1x'), None)
print("Target photo stats from benchmark:", target)
