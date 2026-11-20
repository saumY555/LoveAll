import os, json, urllib.parse, urllib.request, psycopg2
from PIL import Image, ImageDraw

def make_tile(thumb_path, label_top, label_bottom, size=(180, 180)):
    tile = Image.new("RGB", (size[0], size[1] + 55), color=(245, 245, 245))
    if os.path.exists(thumb_path):
        try:
            im = Image.open(thumb_path).convert("RGB")
            im = im.resize(size, Image.Resampling.LANCZOS)
            tile.paste(im, (0, 25))
        except Exception as e:
            print("Error opening thumb:", thumb_path, e)
    draw = ImageDraw.Draw(tile)
    draw.text((5, 5), label_top, fill=(10, 10, 10))
    draw.text((5, size[1] + 30), label_bottom, fill=(60, 60, 60))
    return tile

def main():
    with open('.env') as f:
        env = dict(l.strip().split('=', 1) for l in f if '=' in l and not l.startswith('#'))
    db_url = env['DATABASE_URL_UNPOOLED'].strip('\"')
    p = urllib.parse.urlparse(db_url)

    doh_url = f"https://dns.google/resolve?name={p.hostname}&type=A"
    with urllib.request.urlopen(doh_url, timeout=5) as resp:
        data = json.loads(resp.read().decode())
    answers = [ans['data'] for ans in data.get('Answer', []) if ans.get('type') == 1]
    ipv4 = answers[0]

    conn = psycopg2.connect(
        host=p.hostname,
        hostaddr=ipv4,
        port=p.port or 5432,
        dbname=p.path.lstrip('/'),
        user=p.username,
        password=p.password,
        sslmode='require'
    )
    cur = conn.cursor()

    # 1. Person 15 faces
    cur.execute("""
        SELECT f.id, f."photoId", f."thumbnailUrl", f."boundingBox"
        FROM "Face" f
        WHERE f."personId" = '714976c6-c5ac-4a2e-97ac-9a3974aac7b9'
        ORDER BY f."photoId" ASC, f.id ASC
    """)
    p15_faces = cur.fetchall()
    print(f"Loaded {len(p15_faces)} faces for Person 15")

    p15_by_photo = {}
    for fid, pid, turl, bbox in p15_faces:
        if pid not in p15_by_photo:
            p15_by_photo[pid] = []
        p15_by_photo[pid].append((fid, pid, turl, bbox))

    sheet15 = Image.new("RGB", (440, 840), color=(255, 255, 255))
    draw15 = ImageDraw.Draw(sheet15)
    draw15.text((15, 10), "Person 15: 6 Faces Across 3 Photos (2 per photo)", fill=(0, 0, 0))

    y_offset = 35
    row_idx = 1
    for pid, flist in p15_by_photo.items():
        draw15.text((15, y_offset), f"Photo {row_idx}: {pid[:12]}...", fill=(20, 20, 20))
        y_offset += 20
        x_offset = 15
        for col_idx, (fid, _, turl, bbox) in enumerate(flist):
            thumb_rel = turl.replace('/api/faces/', '') if turl else f"face_{pid}_{col_idx}.webp"
            thumb_path = os.path.join('storage', 'faces', thumb_rel)
            tile = make_tile(thumb_path, f"Face #{col_idx+1} ({fid[:6]})", f"x={bbox['x']:.2f}", (190, 190))
            sheet15.paste(tile, (x_offset, y_offset))
            x_offset += 205
        y_offset += 250
        row_idx += 1

    out_p15 = r"C:\Users\LENOVO\.gemini\antigravity\brain\a8108f23-a290-4b2f-bff3-ecd79ba4f92c\person15_contact_sheet.png"
    sheet15.save(out_p15)
    print(f"Saved: {out_p15}")

    # 2. Person 16
    cur.execute("""
        SELECT f.id, f."photoId", f."thumbnailUrl", f.confidence
        FROM "Face" f
        WHERE f."personId" = '187385e1-0941-405c-9f85-c660274fd839'
        ORDER BY f.id ASC
    """)
    p16_faces = cur.fetchall()
    print(f"Loaded {len(p16_faces)} faces for Person 16")

    dark_prefixes = ['55bcaa03', 'afeb9f49', '77f99e86', '5b12ffb7']
    dark_faces = [f for f in p16_faces if any(f[0].startswith(p) for p in dark_prefixes)]
    normal_faces = [f for f in p16_faces if not any(f[0].startswith(p) for p in dark_prefixes)][:6]

    sim_map = {'afeb9f49': '0.821 (306x344)', '55bcaa03': '0.766 (85x101)', '77f99e86': '0.710 (132x163)', '5b12ffb7': '0.671 (124x152)'}
    bright_map = {'afeb9f49': '21.4', '55bcaa03': '20.4', '77f99e86': '12.0', '5b12ffb7': '19.6'}

    sheet16 = Image.new("RGB", (1240, 580), color=(255, 255, 255))
    draw16 = ImageDraw.Draw(sheet16)
    draw16.text((20, 15), "Person 16: Top Row = 4 Dark Faces (Sim 0.67 - 0.82) | Bottom Row = 6 Normal Reference Faces", fill=(0, 0, 0))

    draw16.text((20, 45), "ROW 1: DARK FACES (Brightness < 25.0)", fill=(180, 0, 0))
    x_offset = 20
    for fid, pid, turl, conf in dark_faces:
        thumb_rel = turl.replace('/api/faces/', '') if turl else ""
        thumb_path = os.path.join('storage', 'faces', thumb_rel)
        prefix = fid[:8]
        tile = make_tile(thumb_path, f"Dark: {prefix} (B={bright_map.get(prefix, '?')})", f"Sim={sim_map.get(prefix, '?')}", (180, 180))
        sheet16.paste(tile, (x_offset, 65))
        x_offset += 200

    draw16.text((20, 315), "ROW 2: NORMAL REFERENCE FACES (Person 16)", fill=(0, 120, 0))
    x_offset = 20
    for fid, pid, turl, conf in normal_faces:
        thumb_rel = turl.replace('/api/faces/', '') if turl else ""
        thumb_path = os.path.join('storage', 'faces', thumb_rel)
        tile = make_tile(thumb_path, f"Ref: {fid[:8]} (conf={conf:.2f})", f"Photo: {pid[:8]}", (180, 180))
        sheet16.paste(tile, (x_offset, 335))
        x_offset += 200

    out_p16 = r"C:\Users\LENOVO\.gemini\antigravity\brain\a8108f23-a290-4b2f-bff3-ecd79ba4f92c\person16_contact_sheet.png"
    sheet16.save(out_p16)
    print(f"Saved: {out_p16}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
