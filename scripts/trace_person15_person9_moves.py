import os
import sys
import json
import urllib.request
import urllib.parse
import psycopg2
from PIL import Image, ImageDraw

def get_db_conn():
    with open('.env') as f:
        env = dict(l.strip().split('=', 1) for l in f if '=' in l and not l.startswith('#'))
    db_url = env['DATABASE_URL_UNPOOLED'].strip('\"')
    p = urllib.parse.urlparse(db_url)

    doh_url = f"https://dns.google/resolve?name={p.hostname}&type=A"
    with urllib.request.urlopen(doh_url, timeout=5) as resp:
        data = json.loads(resp.read().decode())
    answers = [ans['data'] for ans in data.get('Answer', []) if ans.get('type') == 1]
    ipv4 = answers[0]

    return psycopg2.connect(
        host=p.hostname,
        hostaddr=ipv4,
        port=p.port or 5432,
        dbname=p.path.lstrip('/'),
        user=p.username,
        password=p.password,
        sslmode='require'
    )

def make_card(thumb_path, top_text, sub_text, detail_text, border_color=(80, 80, 80), size=(180, 180)):
    card = Image.new("RGB", (size[0] + 10, size[1] + 80), color=(30, 31, 41))
    draw = ImageDraw.Draw(card)
    draw.rectangle([0, 0, size[0] + 9, size[1] + 79], outline=border_color, width=2)
    
    if os.path.exists(thumb_path):
        try:
            im = Image.open(thumb_path).convert("RGB").resize(size, Image.Resampling.LANCZOS)
            card.paste(im, (5, 25))
        except Exception as e:
            print("Error loading:", thumb_path, e)
    else:
        draw.rectangle([5, 25, 5 + size[0], 25 + size[1]], fill=(60, 60, 60))

    draw.text((8, 6), top_text, fill=(255, 255, 255))
    draw.text((8, size[1] + 30), sub_text, fill=(160, 255, 160))
    draw.text((8, size[1] + 50), detail_text, fill=(180, 180, 190))
    return card

def main():
    conn = get_db_conn()
    cur = conn.cursor()

    eventId = 'cmw3ynszk0000wd3wjj5ntc5g'

    # Target photos for Person 9 and Person 15
    p9_photo = 'cmw3ysirk00gqwd3wbx75y980'
    p15_photos = [
        'cmw3ysg0k00g6wd3wpw5jna2y',
        'cmw3ysh2600gewd3w1z07jahv',
        'cmw3ysgbp00g8wd3wst0ibygk'
    ]

    all_target_photos = [p9_photo] + p15_photos

    # Query faces for Person 9 and Person 15 photos in current DB
    cur.execute("""
        SELECT f.id, f."photoId", f."personId", p.name, f."thumbnailUrl", f."boxWidth", f."boxHeight", f.confidence, f."blurScore", f.brightness, f."yawDeg"
        FROM "Face" f
        LEFT JOIN "Person" p ON f."personId" = p.id
        WHERE f."photoId" = ANY(%s)
        ORDER BY f."photoId", f.id
    """, (all_target_photos,))
    target_faces = cur.fetchall()

    print("=" * 80)
    print("CURRENT ASSIGNMENTS FOR FACES FROM PERSON 9 & PERSON 15 PHOTOS:")
    print("=" * 80)
    for r in target_faces:
        fid, pid, pers_id, pname, thumb, bw, bh, conf, blur, b, yaw = r
        source = "Person 9 photo" if pid == p9_photo else "Person 15 photo"
        print(f"[{source}] Face {fid[:8]} | Photo {pid[:12]} | Now in: '{pname}' | Box {bw}x{bh} | Conf {conf:.2f} | B {b:.1f}")

    # Fetch all faces in Person 13 and Person 7
    cur.execute("""
        SELECT f.id, f."photoId", f."personId", p.name, f."thumbnailUrl", f."boxWidth", f."boxHeight", f.confidence, f."blurScore", f.brightness, f."yawDeg"
        FROM "Face" f
        JOIN "Person" p ON f."personId" = p.id
        WHERE p."eventId" = %s AND p.name IN ('Person 13', 'Person 7')
        ORDER BY p.name, f.id
    """, (eventId,))
    big_cluster_faces = cur.fetchall()

    p13_all = [f for f in big_cluster_faces if f[3] == 'Person 13']
    p7_all = [f for f in big_cluster_faces if f[3] == 'Person 7']

    print(f"\nCurrent Person 13 faces: {len(p13_all)}")
    print(f"Current Person 7 faces:  {len(p7_all)}")

    # Check top people by ID
    cur.execute("""
        SELECT p.id, p.name, COUNT(f.id)
        FROM "Person" p
        JOIN "Face" f ON f."personId" = p.id
        WHERE p."eventId" = %s
        GROUP BY p.id, p.name
        ORDER BY COUNT(f.id) DESC
        LIMIT 10
    """, (eventId,))
    top_people = cur.fetchall()
    print("Top 10 People in DB:")
    for r in top_people:
        print(f"  ID: {r[0]} | Name: '{r[1]}' | Faces: {r[2]}")

    # Output contact sheet directory
    out_dir = r"C:\Users\LENOVO\.gemini\antigravity\brain\a8108f23-a290-4b2f-bff3-ecd79ba4f92c"
    os.makedirs(out_dir, exist_ok=True)

    # Build Contact Sheet for Person 13: Target face(s) side-by-side with 8 random existing faces
    import random
    random.seed(42)
    p13_refs = [f for f in p13_all if f[1] not in all_target_photos]
    p13_sample_refs = random.sample(p13_refs, min(8, len(p13_refs)))

    # Sheet for Person 13
    card_w, card_h = 190, 260
    total_cards_13 = len(p13_from_targets) + len(p13_sample_refs)
    if total_cards_13 > 0:
        sheet13_w = total_cards_13 * card_w + 40
        sheet13_h = card_h + 120
        sheet13 = Image.new("RGB", (sheet13_w, sheet13_h), color=(18, 19, 26))
        draw13 = ImageDraw.Draw(sheet13)
        draw13.text((20, 15), "Person 13 Comparison Sheet: Moved Face(s) vs. 8 Random Member Faces", fill=(255, 255, 255))
        draw13.text((20, 40), f"Moved from split photos (Left, highlighted green) | Existing Person 13 cluster members (Right, blue)", fill=(180, 180, 190))

        x = 20
        y = 70
        for f in p13_from_targets:
            fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
            tname = os.path.basename(thumb or f"face_{pid}_0.webp")
            tpath = os.path.join('storage', 'faces', tname)
            card = make_card(tpath, f"MOVED: {fid[:8]}", f"Photo: {pid[:8]}", f"B={b:.1f} Box={bw}x{bh}", border_color=(50, 220, 50))
            sheet13.paste(card, (x, y))
            x += card_w

        # Separator line if needed
        for f in p13_sample_refs:
            fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
            tname = os.path.basename(thumb or f"face_{pid}_0.webp")
            tpath = os.path.join('storage', 'faces', tname)
            card = make_card(tpath, f"REF: {fid[:8]}", f"Photo: {pid[:8]}", f"Conf={conf:.2f}", border_color=(80, 140, 240))
            sheet13.paste(card, (x, y))
            x += card_w

        p13_sheet_path = os.path.join(out_dir, "person13_comparison_sheet.png")
        sheet13.save(p13_sheet_path)
        print(f"Saved: {p13_sheet_path}")

    # Build Contact Sheet for Person 7: Target face(s) side-by-side with 8 random existing faces
    p7_refs = [f for f in p7_all if f[1] not in all_target_photos]
    p7_sample_refs = random.sample(p7_refs, min(8, len(p7_refs)))

    total_cards_7 = len(p7_from_targets) + len(p7_sample_refs)
    if total_cards_7 > 0:
        sheet7_w = total_cards_7 * card_w + 40
        sheet7_h = card_h + 120
        sheet7 = Image.new("RGB", (sheet7_w, sheet7_h), color=(18, 19, 26))
        draw7 = ImageDraw.Draw(sheet7)
        draw7.text((20, 15), "Person 7 Comparison Sheet: Moved Face(s) vs. 8 Random Member Faces", fill=(255, 255, 255))
        draw7.text((20, 40), f"Moved from split photos (Left, highlighted green) | Existing Person 7 cluster members (Right, blue)", fill=(180, 180, 190))

        x = 20
        y = 70
        for f in p7_from_targets:
            fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
            tname = os.path.basename(thumb or f"face_{pid}_0.webp")
            tpath = os.path.join('storage', 'faces', tname)
            card = make_card(tpath, f"MOVED: {fid[:8]}", f"Photo: {pid[:8]}", f"B={b:.1f} Box={bw}x{bh}", border_color=(50, 220, 50))
            sheet7.paste(card, (x, y))
            x += card_w

        for f in p7_sample_refs:
            fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
            tname = os.path.basename(thumb or f"face_{pid}_0.webp")
            tpath = os.path.join('storage', 'faces', tname)
            card = make_card(tpath, f"REF: {fid[:8]}", f"Photo: {pid[:8]}", f"Conf={conf:.2f}", border_color=(80, 140, 240))
            sheet7.paste(card, (x, y))
            x += card_w

        p7_sheet_path = os.path.join(out_dir, "person7_comparison_sheet.png")
        sheet7.save(p7_sheet_path)
        print(f"Saved: {p7_sheet_path}")

    # Also list all faces added to each big cluster since previous scan
    # In previous scan:
    # Person 13 had 52 faces. Now has 55 faces (+3 faces).
    # Person 7 had 51 faces. Now has 51 faces (+0 faces).
    # Person 16 had 43 faces. Now has 45 faces (+2 faces).
    # Person 5 had 34 faces. Now has 39 faces (+5 faces).
    # Person 1 had 39 faces. Now has 39 faces (+0 faces).
    print("\n" + "=" * 80)
    print("BIG CLUSTERS FACE COUNT COMPARISON (Previous Scan vs Current Scan):")
    print("=" * 80)
    cur.execute("""
        SELECT p.name, COUNT(f.id)
        FROM "Person" p
        JOIN "Face" f ON f."personId" = p.id
        WHERE p."eventId" = %s AND p.name IN ('Person 13', 'Person 7', 'Person 16', 'Person 1', 'Person 5')
        GROUP BY p.name
        ORDER BY COUNT(f.id) DESC
    """, (eventId,))
    counts = cur.fetchall()
    prev_map = {'Person 13': 52, 'Person 7': 51, 'Person 16': 43, 'Person 1': 39, 'Person 5': 34}
    for pname, current_count in counts:
        prev = prev_map.get(pname, '?')
        diff = current_count - prev if isinstance(prev, int) else '?'
        print(f"  {pname:<12}: Current = {current_count:>2} faces | Previous = {prev:>2} faces | Delta = +{diff}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
