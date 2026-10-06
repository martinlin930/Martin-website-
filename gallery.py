"""Independent multiplayer gallery; account saves never overwrite Town Life."""
import json
import math
import re
import secrets
import time
from pathlib import Path
from flask import abort, request, session, render_template


def install_gallery(app, database):
    layout = json.loads((Path(__file__).parent / 'static/models/gallery/layout.json').read_text())

    def initialize(db):
        if app.config['DATABASE_URL']:
            return
        db.execute('CREATE TABLE IF NOT EXISTS gallery_players (id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), nickname TEXT NOT NULL, avatar TEXT NOT NULL, x REAL NOT NULL, z REAL NOT NULL, yaw REAL NOT NULL, jump REAL NOT NULL DEFAULT 0, running INTEGER NOT NULL DEFAULT 0, updated REAL NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS gallery_saves (user_id INTEGER PRIMARY KEY REFERENCES users(id), nickname TEXT NOT NULL, avatar TEXT NOT NULL, x REAL NOT NULL, z REAL NOT NULL, yaw REAL NOT NULL, pitch REAL NOT NULL DEFAULT 0, music_muted INTEGER NOT NULL DEFAULT 0, updated REAL NOT NULL)')
        db.execute("CREATE TABLE IF NOT EXISTS gallery_messages (id INTEGER PRIMARY KEY, player_id TEXT NOT NULL, nickname TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL)")
        db.execute('CREATE INDEX IF NOT EXISTS gallery_players_updated_idx ON gallery_players(updated)')

    def payload():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            abort(400)
        return data

    def player(db, data):
        pid = data.get('player_id')
        if not isinstance(pid, str) or pid not in session.get('gallery_players', []):
            abort(401)
        row = db.execute('SELECT * FROM gallery_players WHERE id=?', (pid,)).fetchone()
        if not row or row['user_id'] != session.get('user_id'):
            abort(401)
        return row

    def extra():
        return {'animals': {}, 'pet': {'food': 0, 'xp': 0, 'level': 0, 'claims': {}}, 'dog_name': '', 'room_open': False, 'server_time': time.time()}

    @app.get('/gallery')
    def gallery_page():
        saved = None
        if session.get('user_id'):
            with database() as db:
                initialize(db)
                row = db.execute('SELECT * FROM gallery_saves WHERE user_id=?', (session['user_id'],)).fetchone()
                saved = dict(row) if row else None
        return render_template('gallery.html', saved_game=saved)

    @app.post('/api/gallery/join')
    def join():
        data = payload()
        nickname = data.get('nickname')
        avatar = data.get('avatar', 'r2-000')
        if not isinstance(nickname, str) or not 1 <= len(nickname.strip()) <= 24:
            return {'error': '请输入 1–24 个字符的昵称。'}, 400
        if not isinstance(avatar, str) or not re.fullmatch(r'r2-\d{3}', avatar) or int(avatar[3:]) >= 94:
            return {'error': '请选择有效的角色。'}, 400
        pid = secrets.token_urlsafe(24)
        uid = session.get('user_id')
        now = time.time()
        with database() as db:
            initialize(db)
            row = db.execute('SELECT * FROM gallery_saves WHERE user_id=?', (uid,)).fetchone() if uid else None
            state = dict(row) if row else {'x': layout['spawn'][0], 'z': layout['spawn'][1], 'yaw': layout['yaw'], 'pitch': 0, 'music_muted': 0}
            state['avatar'] = avatar
            db.execute('INSERT INTO gallery_players(id,user_id,nickname,avatar,x,z,yaw,updated) VALUES(?,?,?,?,?,?,?,?)', (pid, uid, nickname.strip(), avatar, state['x'], state['z'], state['yaw'], now))
            if uid:
                db.execute('INSERT INTO gallery_saves(user_id,nickname,avatar,x,z,yaw,pitch,music_muted,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,avatar=excluded.avatar', (uid, nickname.strip(), avatar, state['x'], state['z'], state['yaw'], state['pitch'], state['music_muted'], now))
        session['gallery_players'] = (session.get('gallery_players', []) + [pid])[-12:]
        return dict(extra(), id=pid, nickname=nickname.strip(), persistent=bool(uid), state={k: state[k] for k in ('x', 'z', 'yaw', 'pitch', 'avatar', 'music_muted')})

    @app.post('/api/gallery/state')
    def state():
        data = payload()
        values = [data.get(k, 0) for k in ('x', 'z', 'yaw', 'pitch', 'jump')]
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
            return {'error': 'Invalid movement.'}, 400
        x, z, yaw, pitch, jump = values
        running, muted = data.get('running', False), data.get('music_muted', False)
        if abs(x)>10000 or abs(z)>10000 or abs(pitch)>.7 or not 0<=jump<=3 or not isinstance(running,bool) or not isinstance(muted,bool):
            return {'error': 'Invalid movement.'}, 400
        now = time.time()
        with database() as db:
            initialize(db)
            p = player(db, data)
            db.execute('UPDATE gallery_players SET x=?,z=?,yaw=?,jump=?,running=?,updated=? WHERE id=?', (x,z,yaw,jump,int(running),now,p['id']))
            if p['user_id']:
                db.execute('UPDATE gallery_saves SET x=?,z=?,yaw=?,pitch=?,music_muted=?,updated=? WHERE user_id=?', (x,z,yaw,pitch,int(muted),now,p['user_id']))
            db.execute('DELETE FROM gallery_players WHERE updated<?', (now-30,))
            peers = [dict(r) for r in db.execute('SELECT id,nickname,avatar,x,z,yaw,jump,running FROM gallery_players WHERE id!=?', (p['id'],))]
            messages = [dict(r) for r in db.execute('SELECT id,player_id,nickname,body,created FROM gallery_messages ORDER BY id DESC LIMIT 40')][::-1]
        return dict(extra(), version=app.config['APP_VERSION'], players=peers, messages=messages)

    @app.post('/api/gallery/chat')
    def chat():
        data = payload()
        body = data.get('message')
        if not isinstance(body, str) or not 1 <= len(body.strip()) <= 2000:
            return {'error': '请输入 1–2000 个字符。'}, 400
        if time.time()-session.get('gallery_message_at',0)<1:
            return {'error': '请稍等一下再发送。'}, 429
        with database() as db:
            initialize(db)
            p = player(db,data)
            db.execute('INSERT INTO gallery_messages(player_id,nickname,body,created) VALUES(?,?,?,?)', (p['id'],p['nickname'],body.strip(),time.time()))
            db.execute('DELETE FROM gallery_messages WHERE id<(SELECT COALESCE(MAX(id),0)-200 FROM gallery_messages)')
        session['gallery_message_at']=time.time()
        return {'ok': True}

    @app.post('/api/gallery/leave')
    def leave():
        data = payload()
        with database() as db:
            initialize(db)
            p = player(db,data)
            db.execute('DELETE FROM gallery_players WHERE id=?',(p['id'],))
        return {'ok': True}
