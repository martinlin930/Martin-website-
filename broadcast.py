"""Ephemeral WebRTC signaling shared across Gunicorn workers; media stays peer-to-peer."""
import json, os, secrets, sqlite3, time
from contextlib import contextmanager
from flask import request, session, render_template, abort

def install_broadcast(app, database):
    path = os.environ.get('LIVE_SIGNAL_PATH', '/tmp/martin-live-signals.sqlite3')
    @contextmanager
    def signals():
        db = sqlite3.connect(path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY, host TEXT, touched REAL)')
        db.execute('CREATE TABLE IF NOT EXISTS peers (id TEXT PRIMARY KEY, room TEXT, touched REAL)')
        db.execute('CREATE TABLE IF NOT EXISTS signals (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, sender TEXT, recipient TEXT, body TEXT, created REAL)')
        db.execute('BEGIN IMMEDIATE')
        try:
            now = time.time()
            db.execute('DELETE FROM room WHERE touched < ?', (now-120,))
            db.execute('DELETE FROM peers WHERE touched < ?', (now-120,))
            db.execute('DELETE FROM signals WHERE created < ?', (now-90,))
            yield db
            db.commit()
        finally:
            db.close()

    def admin():
        uid = session.get('user_id')
        if not uid:
            return False
        with database() as db:
            user = db.execute('SELECT is_admin FROM users WHERE id=?', (uid,)).fetchone()
        return bool(user and user['is_admin'])

    def token():
        if 'live_token' not in session:
            session['live_token'] = secrets.token_urlsafe(24)
        return session['live_token']

    def room(db):
        return db.execute('SELECT * FROM room WHERE id=1').fetchone()

    @app.get('/live')
    def live_page():
        token()
        return render_template('live.html', live_admin=admin(), live_signed_in=bool(session.get('user_id')))

    @app.after_request
    def live_no_cache(response):
        if request.path.startswith('/api/live/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/api/live/status')
    def live_status():
        with signals() as db:
            current = room(db)
        return {'active': bool(current)}

    @app.get('/api/live/poll')
    def live_poll():
        own = token()
        cursor = request.args.get('after', '0')
        cursor = int(cursor) if cursor.isdigit() and len(cursor)<18 else 0
        with signals() as db:
            current = room(db)
            if not current:
                return {'active': False, 'messages': [], 'peers': []}
            host = current['host']
            is_host = own == host and admin()
            if own == host and not is_host:
                db.execute('DELETE FROM room')
                return {'active': False, 'messages': [], 'peers': []}
            if is_host:
                db.execute('UPDATE room SET touched=? WHERE id=1', (time.time(),))
            else:
                db.execute('UPDATE peers SET touched=? WHERE id=? AND room=?', (time.time(),own,host))
            registered = is_host or db.execute('SELECT id FROM peers WHERE id=? AND room=?',(own,host)).fetchone()
            rows = db.execute('SELECT id,sender,body FROM signals WHERE recipient=? AND room=? AND id>? ORDER BY id LIMIT 100', (own,host,cursor)).fetchall() if registered else []
            peers = [r['id'] for r in db.execute('SELECT id FROM peers WHERE room=?',(host,))] if is_host else []
        return {'active':True,'room':host,'host':is_host,'peers':peers,'messages':[{'id':r['id'],'sender':r['sender'],'data':json.loads(r['body'])} for r in rows]}

    @app.post('/api/live/start')
    def live_start():
        if not admin():
            abort(403)
        own = token()
        with signals() as db:
            current = room(db)
            if current and current['host'] != own:
                return {'error':'另一位管理员正在直播。'},409
            db.execute('DELETE FROM peers')
            db.execute('DELETE FROM signals')
            db.execute('INSERT OR REPLACE INTO room VALUES (1,?,?)',(own,time.time()))
        return {'ok':True}

    @app.post('/api/live/join')
    def live_join():
        own = token()
        with signals() as db:
            current = room(db)
            if not current:
                return {'error':'管理员还没有开始直播。'},409
            host = current['host']
            if own == host:
                return {'error':'当前浏览器正在主持直播。'},409
            count = db.execute('SELECT COUNT(*) FROM peers WHERE room=?',(host,)).fetchone()[0]
            existing = db.execute('SELECT id FROM peers WHERE id=?',(own,)).fetchone()
            if count>=8 and not existing:
                return {'error':'直播观看人数已满，请稍后再试。'},429
            db.execute('INSERT OR REPLACE INTO peers VALUES (?,?,?)',(own,host,time.time()))
        return {'room':host}

    @app.post('/api/live/signal')
    def live_signal():
        own = token()
        data = request.get_json(silent=True) or {}
        target, payload = data.get('to'), data.get('data')
        if not isinstance(target,str) or not isinstance(payload,dict):
            abort(400)
        kind = payload.get('type')
        if kind not in ('offer','answer','ice') or len(json.dumps(payload))>50000:
            abort(400)
        with signals() as db:
            current = room(db)
            if not current:
                abort(409)
            host = current['host']
            if own == host:
                if not admin() or kind == 'answer' or not db.execute('SELECT id FROM peers WHERE id=? AND room=?',(target,host)).fetchone():
                    abort(403)
            elif target != host or kind == 'offer' or not db.execute('SELECT id FROM peers WHERE id=? AND room=?',(own,host)).fetchone():
                abort(403)
            db.execute('INSERT INTO signals (room,sender,recipient,body,created) VALUES (?,?,?,?,?)',(host,own,target,json.dumps(payload),time.time()))
        return {'ok':True}

    @app.post('/api/live/leave')
    def live_leave():
        own = token()
        with signals() as db:
            current = room(db)
            if current and current['host']==own:
                db.execute('DELETE FROM room')
                db.execute('DELETE FROM peers')
                db.execute('DELETE FROM signals')
            else:
                db.execute('DELETE FROM peers WHERE id=?',(own,))
        return {'ok':True}

    @app.get('/api/live/ice')
    def live_ice():
        servers = [{'urls':['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]
        if os.environ.get('LIVE_TURN_URL'):
            servers.append({'urls':os.environ['LIVE_TURN_URL'].split(','),'username':os.environ.get('LIVE_TURN_USERNAME',''),'credential':os.environ.get('LIVE_TURN_PASSWORD','')})
        response = app.json.response({'iceServers':servers})
        response.headers['Cache-Control']='no-store'
        return response
