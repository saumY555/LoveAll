import os
import sys
import time
import glob
import json
import urllib.parse
import urllib.request
import psycopg2
import psycopg2.extras
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.getcwd(), 'worker'))
from face_engine import FaceEngine

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

def main():
    eventId = 'cmw3ynszk0000wd3wjj5ntc5g'
    conn = get_db_conn()
    cur = conn.cursor()

    # 1. Fetch all photos for the event
    cur.execute("""
        SELECT p.id, a."storageKeyOriginal"
        FROM "Photo" p
        JOIN "PhotoAsset" a ON p."assetId" = a.id
        WHERE p."eventId" = %s AND p."isDeleted" = false
        ORDER BY p."createdAt" ASC
    """, (eventId,))
    photo_rows = cur.fetchall()
    print(f"Loaded {len(photo_rows)} photos from DB for event {eventId}.")

    # Initialize FaceEngine with intra_threads=6
    t0_engine = time.perf_counter()
    engine = FaceEngine(model_name="buffalo_l", det_size=(640, 640), intra_threads=6)
    t1_engine = time.perf_counter()
    print(f"FaceEngine initialized in {(t1_engine - t0_engine)*1000:.1f} ms.")

    faces_output_dir = os.path.join(os.getcwd(), 'storage', 'faces')
    os.makedirs(faces_output_dir, exist_ok=True)

    # 2. Process in chunks of 25 photos
    CHUNK_SIZE = 25
    total_photos = len(photo_rows)
    all_faces_for_clustering = []
    
    t_python_total = 0.0
    t_db_total = 0.0
    total_faces_detected = 0

    print(f"\nProcessing {total_photos} photos in chunks of {CHUNK_SIZE} photos...")
    print(f"{'Chunk':<8} {'Photos':<8} {'Py Time(ms)':<13} {'DB Time(ms)':<13} {'Faces':<7} {'Per-Photo Py':<14} {'Per-Photo DB':<14}")
    print("-" * 85)

    for c_idx in range(0, total_photos, CHUNK_SIZE):
        chunk = photo_rows[c_idx : c_idx + CHUNK_SIZE]
        chunk_num = (c_idx // CHUNK_SIZE) + 1
        num_chunks = (total_photos + CHUNK_SIZE - 1) // CHUNK_SIZE

        # A. Python Stage for 25 photos
        t0_py = time.perf_counter()
        chunk_faces = []
        chunk_photo_ids = [p[0] for p in chunk]

        for p_id, storage_key in chunk:
            img_path = os.path.join(os.getcwd(), 'storage', storage_key)
            if not os.path.exists(img_path):
                continue
            img_bgr = cv2.imread(img_path)
            if img_bgr is None:
                continue

            detected = engine.detect_and_embed_single(
                img_bgr,
                photo_id=p_id,
                output_faces_dir=faces_output_dir,
                conf_threshold=0.48,
                min_face_size=18
            )
            for f in detected:
                # generate unique face ID
                import uuid
                f_id = str(uuid.uuid4())
                f_entry = {
                    "id": f_id,
                    "photoId": p_id,
                    "boundingBox": f["boundingBox"],
                    "embedding": f["embedding"],
                    "confidence": f["confidence"],
                    "thumbnailUrl": f"/api/faces/{f['thumbnailFilename']}",
                    "blurScore": f.get("blurScore"),
                    "brightness": f.get("brightness"),
                    "yawDeg": f.get("yawDeg"),
                    "rollDeg": f.get("rollDeg"),
                    "pitchDeg": f.get("pitchDeg"),
                    "boxWidth": f.get("boxWidth"),
                    "boxHeight": f.get("boxHeight"),
                    "landmarks": f.get("landmarks"),
                    "isLowQuality": False,
                    "isNoise": False,
                }
                chunk_faces.append(f_entry)
                all_faces_for_clustering.append(f_entry)

        t1_py = time.perf_counter()
        py_time_ms = (t1_py - t0_py) * 1000.0
        t_python_total += py_time_ms
        total_faces_detected += len(chunk_faces)

        # B. Batched DB Transaction for 25 photos
        t0_db = time.perf_counter()
        # 1. Delete old faces for chunk
        cur.execute("""
            DELETE FROM "Face"
            WHERE "photoId" = ANY(%s)
        """, (chunk_photo_ids,))

        # 2. Insert all detected faces for chunk
        if chunk_faces:
            insert_query = """
                INSERT INTO "Face" (
                    "id", "photoId", "boundingBox", "embedding", "confidence", "thumbnailUrl",
                    "blurScore", "brightness", "yawDeg", "rollDeg", "pitchDeg",
                    "boxWidth", "boxHeight", "landmarks", "isLowQuality", "isNoise"
                ) VALUES %s
            """
            records = [
                (
                    f["id"], f["photoId"], json.dumps(f["boundingBox"]), json.dumps(f["embedding"]),
                    f["confidence"], f["thumbnailUrl"], f["blurScore"], f["brightness"],
                    f["yawDeg"], f["rollDeg"], f["pitchDeg"], f["boxWidth"], f["boxHeight"],
                    json.dumps(f["landmarks"]) if f["landmarks"] else None,
                    f["isLowQuality"], f["isNoise"]
                )
                for f in chunk_faces
            ]
            psycopg2.extras.execute_values(cur, insert_query, records)

        # 3. Update photo status to DONE
        cur.execute("""
            UPDATE "Photo"
            SET "faceStatus" = 'DONE', "faceProcessedAt" = NOW()
            WHERE "id" = ANY(%s)
        """, (chunk_photo_ids,))

        conn.commit()
        t1_db = time.perf_counter()
        db_time_ms = (t1_db - t0_db) * 1000.0
        t_db_total += db_time_ms

        print(f"{chunk_num}/{num_chunks:<6} {len(chunk):<8} {py_time_ms:<13.1f} {db_time_ms:<13.1f} {len(chunk_faces):<7} {py_time_ms/len(chunk):<14.1f} {db_time_ms/len(chunk):<14.1f}")
        sys.stdout.flush()

    print("=" * 85)
    print(f"SCAN STAGE COMPLETE FOR {total_photos} PHOTOS ({total_faces_detected} faces):")
    print(f"  Total Python Time:   {t_python_total:>8.1f} ms  ({t_python_total/total_photos:>6.1f} ms/photo, {t_python_total/1000.0:.2f} s)")
    print(f"  Total DB Time:       {t_db_total:>8.1f} ms  ({t_db_total/total_photos:>6.1f} ms/photo, {t_db_total/1000.0:.2f} s)")
    print(f"  Grand Total Scan:    {(t_python_total + t_db_total)/1000.0:.2f} seconds!")
    print("=" * 85)

    # 3. Clustering Stage with Cannot-Link & Item 4 (No Person rows for bad singletons)
    print("\nRunning Clustering on all faces with cannot-link (1000 penalty) + 2-means split...")
    t0_cluster = time.perf_counter()
    cluster_payload = [
        {
            "id": f["id"],
            "embedding": f["embedding"],
            "photoId": f["photoId"]
        }
        for f in all_faces_for_clustering
    ]
    cluster_res = FaceEngine.cluster_faces(cluster_payload, eps=0.50, min_samples=1)
    t1_cluster = time.perf_counter()
    print(f"Clustering complete in {(t1_cluster - t0_cluster)*1000:.1f} ms: {len(cluster_res['clusters'])} raw clusters found.")

    # 4. Filter Person rows (Item 4):
    # Only create Person rows for clusters with >= 2 distinct photos OR HQ singletons
    face_map = {f["id"]: f for f in all_faces_for_clustering}

    qualified_people = []
    assignments = []
    unassigned_count = 0

    person_counter = 1
    import uuid

    for cl in cluster_res["clusters"]:
        c_faces = [face_map[fid] for fid in cl["faceIds"] if fid in face_map]
        photo_ids = set(f["photoId"] for f in c_faces)
        distinct_photos = len(photo_ids)
        faces_count = len(c_faces)

        is_multi_photo = distinct_photos >= 2
        is_hq_singleton = False

        if distinct_photos == 1 and faces_count == 1:
            f = c_faces[0]
            min_box = min(f.get("boxWidth") or 0, f.get("boxHeight") or 0)
            conf = f.get("confidence") or 0.0
            b = f.get("brightness") or 0.0
            blur = f.get("blurScore") or 0.0
            yaw = abs(f.get("yawDeg") or 0.0)

            # Strict HQ Singleton rule
            if min_box >= 75 and conf >= 0.85 and b >= 40.0 and blur >= 20.0 and (f.get("yawDeg") is None or yaw <= 80):
                is_hq_singleton = True

        if is_multi_photo or is_hq_singleton:
            p_id = str(uuid.uuid4())
            rep_face = face_map.get(cl["representativeFaceId"]) or c_faces[0]
            p_name = f"Person {person_counter}"
            person_counter += 1

            qualified_people.append({
                "id": p_id,
                "eventId": eventId,
                "name": p_name,
                "thumbnailUrl": rep_face["thumbnailUrl"],
                "isCover": (person_counter == 2),
                "isHidden": False,
                "faceIds": cl["faceIds"],
                "reason": "multi-photo" if is_multi_photo else "hq-singleton"
            })

            for fid in cl["faceIds"]:
                assignments.append((p_id, fid))
        else:
            # Item 4: DO NOT create a Person row! Keep face unassigned (personId = NULL)
            unassigned_count += len(cl["faceIds"])
            for fid in cl["faceIds"]:
                assignments.append((None, fid))

    for nid in cluster_res["noiseFaceIds"]:
        unassigned_count += 1
        assignments.append((None, nid))

    print(f"\nITEM 4 APPLICATION:")
    print(f"  Total Clusters Evaluated:      {len(cluster_res['clusters'])}")
    print(f"  Qualified People Created:      {len(qualified_people)}")
    print(f"    - Multi-Photo People:        {len([p for p in qualified_people if p['reason'] == 'multi-photo'])}")
    print(f"    - High-Quality Singletons:   {len([p for p in qualified_people if p['reason'] == 'hq-singleton'])}")
    print(f"  Unassigned Faces (otherFaces): {unassigned_count}")

    # Persist People & Assignments in DB
    # First, delete existing people for event
    cur.execute('DELETE FROM "Person" WHERE "eventId" = %s', (eventId,))

    # Insert qualified people
    if qualified_people:
        insert_p_query = """
            INSERT INTO "Person" ("id", "eventId", "name", "thumbnailUrl", "isCover", "isHidden", "createdAt", "updatedAt")
            VALUES %s
        """
        p_records = [
            (p["id"], p["eventId"], p["name"], p["thumbnailUrl"], p["isCover"], p["isHidden"], 'NOW()', 'NOW()')
            for p in qualified_people
        ]
        psycopg2.extras.execute_values(cur, insert_p_query, p_records)

    # Update face personId assignments
    update_face_query = """
        UPDATE "Face" AS f
        SET "personId" = u.person_id
        FROM (VALUES %s) AS u(person_id, face_id)
        WHERE f.id = u.face_id
    """
    # Cast person_id to text
    psycopg2.extras.execute_values(cur, """
        UPDATE "Face" AS f
        SET "personId" = u.person_id::text
        FROM (VALUES %s) AS u(person_id, face_id)
        WHERE f.id = u.face_id::text
    """, assignments)

    conn.commit()
    print("Database updated with clean people and assignments!")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
