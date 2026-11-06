import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute('''
    SELECT p.id, pa."storageKeyOriginal" 
    FROM "Photo" p 
    JOIN "PhotoAsset" pa ON pa.id = p."assetId" 
    WHERE p."faceStatus" = 'PENDING' AND p."isDeleted" = false
''')
rows = cur.fetchall()
print(f"Total pending photos: {len(rows)}")

missing = []
for pid, key in rows:
    full_path = os.path.join("storage", key)
    if not os.path.exists(full_path):
        missing.append((pid, full_path))

print(f"Missing files: {len(missing)}")
if missing:
    print("Sample missing:", missing[:5])
else:
    print("All pending photo files exist in storage!")
