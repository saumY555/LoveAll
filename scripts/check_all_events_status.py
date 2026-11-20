import os, json, urllib.parse, urllib.request, psycopg2

with open('.env') as f:
    env = dict(l.strip().split('=', 1) for l in f if '=' in l and not l.startswith('#'))
db_url = env['DATABASE_URL_UNPOOLED'].strip('\"')
p = urllib.parse.urlparse(db_url)
doh_url = f"https://dns.google/resolve?name={p.hostname}&type=A"
with urllib.request.urlopen(doh_url, timeout=5) as resp:
    data = json.loads(resp.read().decode())
ipv4 = [ans['data'] for ans in data.get('Answer', []) if ans.get('type') == 1][0]

conn = psycopg2.connect(
    host=p.hostname, hostaddr=ipv4, port=p.port or 5432,
    dbname=p.path.lstrip('/'), user=p.username, password=p.password, sslmode='require'
)
cur = conn.cursor()

cur.execute("""
    SELECT e.id, e.name, p."faceStatus", COUNT(p.id)
    FROM "Photo" p
    JOIN "Event" e ON p."eventId" = e.id
    WHERE p."isDeleted" = false
    GROUP BY e.id, e.name, p."faceStatus"
    ORDER BY e.name, p."faceStatus"
""")
rows = cur.fetchall()
print("Photo FaceStatus by Event:")
for r in rows:
    print(f"  Event '{r[1]}' ({r[0][:12]}..): status={r[2]} count={r[3]}")

# Check event 'h'
cur.execute("""
    SELECT e.id, e.name, e."createdAt", COUNT(p.id)
    FROM "Event" e
    JOIN "Photo" p ON p."eventId" = e.id
    WHERE e.name = 'h'
    GROUP BY e.id, e.name, e."createdAt"
""")
print("\nEvent 'h' details:")
for r in cur.fetchall():
    print(f"  ID: {r[0]} | Name: {r[1]} | Created: {r[2]} | Photos: {r[3]}")

cur.close()
conn.close()
