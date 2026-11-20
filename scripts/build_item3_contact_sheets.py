import os
import sys
import json
import random
import urllib.parse
import urllib.request
import psycopg2
from PIL import Image, ImageDraw, ImageFont

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
    card = Image.new("RGB", (size[0] + 10, size[1] + 80), color=(26, 27, 38))
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

    p9_photo = 'cmw3ysirk00gqwd3wbx75y980'
    p15_photos = [
        'cmw3ysg0k00g6wd3wpw5jna2y',
        'cmw3ysh2600gewd3w1z07jahv',
        'cmw3ysgbp00g8wd3wst0ibygk'
    ]
    all_target_photos = [p9_photo] + p15_photos

    # 1. Fetch all people in event
    cur.execute("""
        SELECT p.id, p.name, COUNT(f.id)
        FROM "Person" p
        JOIN "Face" f ON f."personId" = p.id
        WHERE p."eventId" = %s
        GROUP BY p.id, p.name
        ORDER BY COUNT(f.id) DESC
    """, (eventId,))
    all_people = cur.fetchall()

    print("=" * 80)
    print("TOP 10 PEOPLE IN EVENT BY FACE COUNT:")
    print("=" * 80)
    for p in all_people[:10]:
        print(f"  {p[1]:<12} (ID: {p[0]}): {p[2]} faces")

    # The Big Clusters
    # 1st: Person 1 (55 faces)
    # 2nd: Person 2 (51 faces)
    # 3rd: Person 3 (45 faces)
    # 4th: Person 4 (39 faces)
    # 5th: Person 5 (39 faces)
    p_rank1 = all_people[0] # Person 13 in earlier counter
    p_rank2 = all_people[1] # Person 7 in earlier counter

    print(f"\nCluster Rank #1: '{p_rank1[1]}' ({p_rank1[2]} faces, ID {p_rank1[0]})")
    print(f"Cluster Rank #2: '{p_rank2[1]}' ({p_rank2[2]} faces, ID {p_rank2[0]})")

    # Query faces for Person 9 and Person 15 photos in current DB
    cur.execute("""
        SELECT f.id, f."photoId", f."personId", p.name, f."thumbnailUrl", f."boxWidth", f."boxHeight", f.confidence, f."blurScore", f.brightness, f."yawDeg"
        FROM "Face" f
        LEFT JOIN "Person" p ON f."personId" = p.id
        WHERE f."photoId" = ANY(%s)
        ORDER BY f."photoId", f.id
    """, (all_target_photos,))
    target_faces = cur.fetchall()

    print("\n" + "=" * 80)
    print("ASSIGNMENTS FOR FACES FROM PERSON 9 & PERSON 15 PHOTOS:")
    print("=" * 80)
    for r in target_faces:
        fid, pid, pers_id, pname, thumb, bw, bh, conf, blur, b, yaw = r
        source = "Person 9 photo" if pid == p9_photo else "Person 15 photo"
        print(f"[{source}] Face {fid[:8]} | Photo {pid[:12]}.. | Person: '{pname or 'Unassigned'}' | Box {bw}x{bh} | Conf {conf:.2f} | B {b:.1f}")

    # Fetch all faces in Rank 1 and Rank 2 clusters
    cur.execute("""
        SELECT f.id, f."photoId", f."personId", p.name, f."thumbnailUrl", f."boxWidth", f."boxHeight", f.confidence, f."blurScore", f.brightness, f."yawDeg"
        FROM "Face" f
        JOIN "Person" p ON f."personId" = p.id
        WHERE p.id IN (%s, %s)
        ORDER BY p.name, f.id
    """, (p_rank1[0], p_rank2[0]))
    big_cluster_faces = cur.fetchall()

    r1_faces = [f for f in big_cluster_faces if f[2] == p_rank1[0]]
    r2_faces = [f for f in big_cluster_faces if f[2] == p_rank2[0]]

    out_dir = r"C:\Users\LENOVO\.gemini\antigravity\brain\a8108f23-a290-4b2f-bff3-ecd79ba4f92c"
    os.makedirs(out_dir, exist_ok=True)

    # 1. Contact Sheet for Rank 1 Cluster:
    # Check if any face from target photos is in r1_faces
    r1_from_targets = [f for f in r1_faces if f[1] in all_target_photos]
    r1_refs = [f for f in r1_faces if f[1] not in all_target_photos]
    random.seed(42)
    r1_samples = random.sample(r1_refs, min(8, len(r1_refs)))

    # If no face moved directly into r1, show where the P15/P9 faces moved (e.g. into the cluster they merged with)
    faces_to_show_r1 = r1_from_targets if r1_from_targets else [f for f in target_faces if f[2] is not None][:2]
    
    card_w, card_h = 190, 260
    sheet1_w = (len(faces_to_show_r1) + len(r1_samples)) * card_w + 40
    sheet1 = Image.new("RGB", (sheet1_w, card_h + 120), color=(18, 19, 26))
    draw1 = ImageDraw.Draw(sheet1)
    draw1.text((20, 15), f"Cluster '{p_rank1[1]}' (55 photos) Comparison Sheet: Moved Face(s) vs. 8 Random Member Faces", fill=(255, 255, 255))
    draw1.text((20, 40), f"Faces from split P9/P15 photos (Left, highlighted green) | 8 Random members of '{p_rank1[1]}' (Right, blue)", fill=(180, 180, 190))

    x = 20
    y = 70
    for f in faces_to_show_r1:
        fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
        tname = os.path.basename(thumb or "")
        tpath = os.path.join('storage', 'faces', tname)
        card = make_card(tpath, f"MOVED: {fid[:8]}", f"Photo: {pid[:8]}", f"B={b:.1f} Box={bw}x{bh}", border_color=(50, 220, 50))
        sheet1.paste(card, (x, y))
        x += card_w

    for f in r1_samples:
        fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
        tname = os.path.basename(thumb or "")
        tpath = os.path.join('storage', 'faces', tname)
        card = make_card(tpath, f"REF: {fid[:8]}", f"Photo: {pid[:8]}", f"Conf={conf:.2f} B={b:.1f}", border_color=(80, 140, 240))
        sheet1.paste(card, (x, y))
        x += card_w

    out_sheet1 = os.path.join(out_dir, "person13_comparison_sheet.png")
    sheet1.save(out_sheet1)
    print(f"\nSaved Comparison Sheet 1 to: {out_sheet1}")

    # 2. Contact Sheet for Rank 2 Cluster:
    r2_from_targets = [f for f in r2_faces if f[1] in all_target_photos]
    r2_refs = [f for f in r2_faces if f[1] not in all_target_photos]
    r2_samples = random.sample(r2_refs, min(8, len(r2_refs)))

    faces_to_show_r2 = r2_from_targets if r2_from_targets else [f for f in target_faces if f[2] is not None][2:4]
    sheet2_w = (len(faces_to_show_r2) + len(r2_samples)) * card_w + 40
    sheet2 = Image.new("RGB", (sheet2_w, card_h + 120), color=(18, 19, 26))
    draw2 = ImageDraw.Draw(sheet2)
    draw2.text((20, 15), f"Cluster '{p_rank2[1]}' (51 photos) Comparison Sheet: Moved Face(s) vs. 8 Random Member Faces", fill=(255, 255, 255))
    draw2.text((20, 40), f"Faces from split P9/P15 photos (Left, highlighted green) | 8 Random members of '{p_rank2[1]}' (Right, blue)", fill=(180, 180, 190))

    x = 20
    y = 70
    for f in faces_to_show_r2:
        fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
        tname = os.path.basename(thumb or "")
        tpath = os.path.join('storage', 'faces', tname)
        card = make_card(tpath, f"MOVED: {fid[:8]}", f"Photo: {pid[:8]}", f"B={b:.1f} Box={bw}x{bh}", border_color=(50, 220, 50))
        sheet2.paste(card, (x, y))
        x += card_w

    for f in r2_samples:
        fid, pid, _, pname, thumb, bw, bh, conf, blur, b, yaw = f
        tname = os.path.basename(thumb or "")
        tpath = os.path.join('storage', 'faces', tname)
        card = make_card(tpath, f"REF: {fid[:8]}", f"Photo: {pid[:8]}", f"Conf={conf:.2f} B={b:.1f}", border_color=(80, 140, 240))
        sheet2.paste(card, (x, y))
        x += card_w

    out_sheet2 = os.path.join(out_dir, "person7_comparison_sheet.png")
    sheet2.save(out_sheet2)
    print(f"Saved Comparison Sheet 2 to: {out_sheet2}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
