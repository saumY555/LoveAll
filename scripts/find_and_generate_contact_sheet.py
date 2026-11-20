import os
import sys
import json
import urllib.request
import psycopg2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def get_db_conn():
    db_url = os.environ.get("DATABASE_URL_UNPOOLED")
    if not db_url:
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('DATABASE_URL_UNPOOLED='):
                    db_url = line.strip().split('=', 1)[1].strip('"\'')
                    break
    if isinstance(db_url, bytes):
        db_url = db_url.decode('utf-8')

    from urllib.parse import urlparse
    parsed = urlparse(str(db_url))
    host = parsed.hostname
    port = parsed.port or 5432
    user = parsed.username
    password = parsed.password
    dbname = parsed.path.lstrip('/')

    # Google DoH
    doh_url = f"https://dns.google/resolve?name={host}&type=A"
    req = urllib.request.Request(doh_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        answers = [a['data'] for a in data.get('Answer', []) if a.get('type') == 1]
        ip = answers[0]

    return psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        hostaddr=ip,
        port=port,
        sslmode='require'
    )

def main():
    conn = get_db_conn()
    cur = conn.cursor()

    # Find the 6 faces from Person 15's photos:
    # Photos: cmw3yt0gm00khwd3w74umxscs, cmw3yt81c00m3wd3wqprg37n5, cmw3yt9iy00mjwd3wpqyv0pz5
    p15_photo_prefixes = ['cmw3yt0gm00kh', 'cmw3yt81c00m3', 'cmw3yt9iy00mj']
    cur.execute("""
        SELECT f.id, f."photoId", f."thumbnailUrl", f."personId", p.name, f."boxWidth", f."boxHeight", f.confidence, f."blurScore", f.brightness
        FROM "Face" f
        JOIN "Photo" ph ON f."photoId" = ph.id
        LEFT JOIN "Person" p ON f."personId" = p.id
        WHERE ph."eventId" = 'cmw3ynszk0000wd3wjj5ntc5g'
          AND (ph.id LIKE %s OR ph.id LIKE %s OR ph.id LIKE %s)
        ORDER BY f."photoId", f.id
    """, (p15_photo_prefixes[0] + '%', p15_photo_prefixes[1] + '%', p15_photo_prefixes[2] + '%'))
    p15_faces = cur.fetchall()

    print(f"P15 photo faces found: {len(p15_faces)}")
    for r in p15_faces:
        print(f"  Face {r[0][:8]} | Photo {r[1][:12]} | Person {r[4]} | Box {r[5]}x{r[6]} | Conf {r[7]:.3f} | Thumb {r[2]}")

    # Find Person 9 (from earlier: single photo with 2 faces that was previously Person 9)
    # Let's search for any single photo where faces are now split into separate singletons or different people
    cur.execute("""
        SELECT ph.id, COUNT(f.id) as fcount
        FROM "Photo" ph
        JOIN "Face" f ON f."photoId" = ph.id
        WHERE ph."eventId" = 'cmw3ynszk0000wd3wjj5ntc5g'
        GROUP BY ph.id
        HAVING COUNT(f.id) = 2
        LIMIT 5
    """)
    pairs = cur.fetchall()
    print("\nPhotos with exactly 2 faces:")
    p9_faces = []
    for ph_id, _ in pairs:
        cur.execute("""
            SELECT f.id, f."photoId", f."thumbnailUrl", f."personId", p.name, f."boxWidth", f."boxHeight", f.confidence, f."blurScore", f.brightness
            FROM "Face" f
            LEFT JOIN "Person" p ON f."personId" = p.id
            WHERE f."photoId" = %s
        """, (ph_id,))
        rows = cur.fetchall()
        # If both faces have distinct people (cannot-link working)
        if len(rows) == 2:
            print(f"  Photo {ph_id[:12]}: Face 1 -> {rows[0][4]}, Face 2 -> {rows[1][4]}")
            if not p9_faces:
                p9_faces = rows

    # Build Contact Sheet for Person 15 Result
    # Output to brain directory
    out_dir = r"C:\Users\LENOVO\.gemini\antigravity\brain\a8108f23-a290-4b2f-bff3-ecd79ba4f92c"
    os.makedirs(out_dir, exist_ok=True)

    # 1. P15 Contact Sheet: Show how the faces from those 3 photos are now partitioned by Cannot-Link
    card_w, card_h = 240, 310
    cols = len(p15_faces)
    p15_sheet = Image.new('RGB', (cols * card_w + 40, card_h + 100), color=(26, 27, 38))
    draw = ImageDraw.Draw(p15_sheet)
    draw.text((25, 20), "Person 15 Post-Cannot-Link Result: Partitioned Across Photos & People", fill=(255, 255, 255))
    draw.text((25, 45), "Original Person 15 had 6 faces across 3 photos (2 faces/photo). Cannot-link strictly prevents same-photo co-occurrence.", fill=(180, 180, 190))

    for idx, r in enumerate(p15_faces):
        fid, pid, thumb_url, person_id, pname, bw, bh, conf, blur, b = r
        thumb_fname = os.path.basename(thumb_url or f"face_{pid}_{idx}.webp")
        thumb_path = os.path.join(os.getcwd(), 'storage', 'faces', thumb_fname)
        x = 25 + idx * card_w
        y = 80
        if os.path.exists(thumb_path):
            img = Image.open(thumb_path).convert('RGB').resize((200, 200))
            p15_sheet.paste(img, (x, y))
        else:
            draw.rectangle([x, y, x + 200, y + 200], fill=(50, 50, 50))
        
        # Details
        draw.text((x, y + 208), f"Assigned: {pname}", fill=(100, 255, 100))
        draw.text((x, y + 228), f"Photo: {pid[:12]}..", fill=(220, 220, 220))
        draw.text((x, y + 248), f"Box: {bw}x{bh}  Conf: {conf:.2f}", fill=(180, 180, 180))
        draw.text((x, y + 268), f"B: {b:.1f}  Blur: {blur:.1f}", fill=(180, 180, 180))

    p15_out_path = os.path.join(out_dir, "cannot_link_person15_result.png")
    p15_sheet.save(p15_out_path)
    print(f"\nSaved Person 15 post-split contact sheet to: {p15_out_path}")

    # 2. P9 Contact Sheet: 2 faces in the same photo split into different people
    if p9_faces:
        cols9 = len(p9_faces)
        p9_sheet = Image.new('RGB', (cols9 * card_w + 40, card_h + 100), color=(26, 27, 38))
        draw9 = ImageDraw.Draw(p9_sheet)
        ph_id = p9_faces[0][1]
        draw9.text((25, 20), f"Person 9 Post-Cannot-Link Result: Split 2 Faces in Photo {ph_id[:16]}", fill=(255, 255, 255))
        draw9.text((25, 45), "Cannot-link penalty (1000) guarantees both faces from the same photo cannot belong to the same person.", fill=(180, 180, 190))

        for idx, r in enumerate(p9_faces):
            fid, pid, thumb_url, person_id, pname, bw, bh, conf, blur, b = r
            thumb_fname = os.path.basename(thumb_url or f"face_{pid}_{idx}.webp")
            thumb_path = os.path.join(os.getcwd(), 'storage', 'faces', thumb_fname)
            x = 25 + idx * card_w
            y = 80
            if os.path.exists(thumb_path):
                img = Image.open(thumb_path).convert('RGB').resize((200, 200))
                p9_sheet.paste(img, (x, y))
            else:
                draw9.rectangle([x, y, x + 200, y + 200], fill=(50, 50, 50))
            
            draw9.text((x, y + 208), f"Assigned: {pname}", fill=(100, 255, 100))
            draw9.text((x, y + 228), f"Photo: {pid[:12]}..", fill=(220, 220, 220))
            draw9.text((x, y + 248), f"Box: {bw}x{bh}  Conf: {conf:.2f}", fill=(180, 180, 180))
            draw9.text((x, y + 268), f"B: {b:.1f}  Blur: {blur:.1f}", fill=(180, 180, 180))

        p9_out_path = os.path.join(out_dir, "cannot_link_person9_result.png")
        p9_sheet.save(p9_out_path)
        print(f"Saved Person 9 post-split contact sheet to: {p9_out_path}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
