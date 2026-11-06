import os
from PIL import Image

folder = r"C:\Users\LENOVO\OneDrive\Pictures\Nepal trip 2k26"
matches = []
for fname in os.listdir(folder):
    if fname.lower().endswith(".jpg"):
        fpath = os.path.join(folder, fname)
        try:
            with Image.open(fpath) as img:
                w, h = img.size
                if (w, h) in [(4080, 3060), (3060, 4080)]:
                    matches.append((fname, fpath, (w, h), os.path.getsize(fpath)))
        except Exception:
            pass

print(f"Total matching photos: {len(matches)}")
for m in matches[:10]:
    print(m)
