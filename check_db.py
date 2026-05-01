import sqlite3
c = sqlite3.connect('backend/tickets.db')
tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print('Tables:', tables)
if 'feedbacks' in tables:
    rows = c.execute('SELECT * FROM feedbacks').fetchall()
    print('Feedbacks count:', len(rows))
    for r in rows:
        print(' ', r)
else:
    print('feedbacks table does NOT exist - needs migration')
if 'users' in tables:
    users = c.execute('SELECT id, email, role, is_verified FROM users').fetchall()
    print('Users:', users)
c.close()
