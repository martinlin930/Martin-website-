import os
import hashlib
import re
import secrets
import sqlite3
import psycopg
from postgres_store import database as postgres_database
import math
import json
import time
from pathlib import Path
from contextlib import contextmanager

import click
from flask import Flask, abort, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=str(BASE_DIR / 'templates'))
app.config.update(
    DATABASE_URL=os.environ.get('DATABASE_URL', ''),
    DATABASE=os.environ.get('DATABASE_PATH', str(BASE_DIR / 'instance' / 'users.sqlite3')),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('COOKIE_SECURE') == '1',
    MAX_CONTENT_LENGTH=16 * 1024,
)
# Persist the local secret so sessions survive restarts. Set SECRET_KEY in production.
secret = os.environ.get('SECRET_KEY')
if app.config['DATABASE_URL'] and not secret:
    raise RuntimeError('Set a persistent SECRET_KEY when using PostgreSQL.')
if not secret:
    secret_path = Path(app.config['DATABASE']).parent / 'secret.key'
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with secret_path.open('x') as file:
            os.chmod(secret_path, 0o600)
            file.write(secrets.token_hex(32))
    except FileExistsError:
        pass
    secret = secret_path.read_text().strip()
app.secret_key = secret
DUMMY_HASH = generate_password_hash(secrets.token_hex(32))

def build_version():
    commit=os.environ.get('RENDER_GIT_COMMIT')
    if commit:
        return commit
    digest=hashlib.sha256()
    files=list(BASE_DIR.glob('*.py'))+list((BASE_DIR/'static').glob('*.js'))+list((BASE_DIR/'static').glob('*.css'))+list((BASE_DIR/'templates').rglob('*.html'))
    for path in sorted(files):
        digest.update(str(path.relative_to(BASE_DIR)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()

APP_VERSION=build_version()

@app.get('/api/version')
def app_version():
    response=app.json.response({'version':APP_VERSION})
    response.headers['Cache-Control']='no-store'
    return response

@app.after_request
def revalidate_app_code(response):
    if request.path.endswith(('.js','.css')) or response.mimetype=='text/html':
        response.headers['Cache-Control']='no-cache'
    return response




@contextmanager
def database():
    if app.config['DATABASE_URL']:
        with postgres_database(app.config['DATABASE_URL']) as connection:
            yield connection
        return
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(app.config['DATABASE'])
    connection.row_factory = sqlite3.Row
    connection.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)')
    user_columns = {row['name'] for row in connection.execute('PRAGMA table_info(users)')}
    if 'is_admin' not in user_columns:
        connection.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
    connection.execute('CREATE TABLE IF NOT EXISTS login_attempts (username TEXT PRIMARY KEY, failures INTEGER NOT NULL, last_attempt INTEGER NOT NULL)')
    connection.execute('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, nickname TEXT NOT NULL, x REAL NOT NULL, z REAL NOT NULL, updated REAL NOT NULL)')
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(players)')}
    if 'yaw' not in columns:
        connection.execute('ALTER TABLE players ADD COLUMN yaw REAL NOT NULL DEFAULT 0')
    if 'jump' not in columns:
        connection.execute('ALTER TABLE players ADD COLUMN jump REAL NOT NULL DEFAULT 0')
    if 'running' not in columns:
        connection.execute('ALTER TABLE players ADD COLUMN running INTEGER NOT NULL DEFAULT 0')
    if 'avatar' not in columns:
        connection.execute("ALTER TABLE players ADD COLUMN avatar TEXT NOT NULL DEFAULT '01m'")
    if 'user_id' not in columns:
        connection.execute('ALTER TABLE players ADD COLUMN user_id INTEGER REFERENCES users(id)')
    connection.execute('''CREATE TABLE IF NOT EXISTS game_saves (
        user_id INTEGER PRIMARY KEY REFERENCES users(id), nickname TEXT NOT NULL,
        avatar TEXT NOT NULL, x REAL NOT NULL, z REAL NOT NULL, yaw REAL NOT NULL,
        pitch REAL NOT NULL DEFAULT 0, music_muted INTEGER NOT NULL DEFAULT 0,
        updated REAL NOT NULL, save_version INTEGER NOT NULL DEFAULT 1)''')
    save_columns = {row['name'] for row in connection.execute('PRAGMA table_info(game_saves)')}
    if 'dog_name' not in save_columns:
        connection.execute("ALTER TABLE game_saves ADD COLUMN dog_name TEXT NOT NULL DEFAULT ''")
    for column,definition in {'animal_pets':"TEXT NOT NULL DEFAULT '{}'",'dog_food':'INTEGER NOT NULL DEFAULT 0','dog_xp':'INTEGER NOT NULL DEFAULT 0','food_claims':"TEXT NOT NULL DEFAULT '{}'",'dog_interaction_at':'REAL NOT NULL DEFAULT 0'}.items():
        if column not in save_columns:
            connection.execute('ALTER TABLE game_saves ADD COLUMN '+column+' '+definition)
    connection.execute('CREATE TABLE IF NOT EXISTS world_objects (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)')
    connection.execute("INSERT INTO world_objects(name,value) VALUES('room-door',0) ON CONFLICT(name) DO NOTHING")
    connection.execute('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL)')
    connection.execute('CREATE TABLE IF NOT EXISTS forum_posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), display_name TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL)')
    connection.execute('CREATE TABLE IF NOT EXISTS forum_images (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES forum_posts(id), jpeg_base64 TEXT NOT NULL)')
    connection.execute('CREATE TABLE IF NOT EXISTS forum_comments (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES forum_posts(id), user_id INTEGER NOT NULL REFERENCES users(id), display_name TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL)')
    for table in ('forum_posts', 'forum_comments'):
        columns = {row['name'] for row in connection.execute('PRAGMA table_info('+table+')')}
        for column,definition in {'deleted_at':'REAL', 'deleted_by':'INTEGER REFERENCES users(id)'}.items():
            if column not in columns:
                connection.execute('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition)
    connection.execute('CREATE INDEX IF NOT EXISTS forum_images_post_idx ON forum_images(post_id,id)')
    connection.execute('CREATE INDEX IF NOT EXISTS forum_comments_post_idx ON forum_comments(post_id,id)')
    connection.execute('CREATE INDEX IF NOT EXISTS forum_posts_user_idx ON forum_posts(user_id,id)')
    connection.execute('CREATE INDEX IF NOT EXISTS forum_comments_user_idx ON forum_comments(user_id,id)')
    connection.commit()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


@app.context_processor
def auth_context():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_urlsafe(32)
    return {'csrf_token': session['csrf_token'],'app_version':APP_VERSION}


@app.before_request
def check_csrf():
    if request.path == '/api/forum/posts' and request.method == 'POST':
        request.max_content_length = 17 * 1024 * 1024
    if request.method == 'POST':
        expected = session.get('csrf_token', '')
        supplied = request.headers.get('X-CSRF-Token', '') or request.form.get('csrf_token', '')
        if not expected or not secrets.compare_digest(expected, supplied):
            abort(400, description='Form expired. Reload the page and try again.')


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/work')
def work():
    return render_template('work.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('user_id'):
        return redirect('/forum' if request.args.get('next') == '/forum' else url_for('account'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()[:80]
        password = request.form.get('password', '')
        with database() as db:
            attempt = db.execute("SELECT * FROM login_attempts WHERE username = ? AND last_attempt > ?", (username, int(time.time()) - 900,)).fetchone()
            if attempt and attempt['failures'] >= 10:
                return render_template('login.html', error='Too many attempts. Try again in 15 minutes.', username=username), 429
            user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            valid = check_password_hash(user['password_hash'] if user else DUMMY_HASH, password)
            if user and valid:
                db.execute('DELETE FROM login_attempts WHERE username = ?', (username,))
                session.clear()
                session['user_id'] = user['id']
                session['username'] = user['username']
                return redirect('/forum' if request.args.get('next') == '/forum' else url_for('account'))
            db.execute("INSERT INTO login_attempts VALUES (?, 1, ?) ON CONFLICT(username) DO UPDATE SET failures = CASE WHEN login_attempts.last_attempt > ? THEN login_attempts.failures + 1 ELSE 1 END, last_attempt = excluded.last_attempt", (username, int(time.time()), int(time.time()) - 900))
        error = 'Incorrect username or password.'
    return render_template('login.html', error=error, username=request.form.get('username', ''))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if session.get('user_id'):
        return redirect('/forum' if request.args.get('next') == '/forum' else url_for('account'))
    error = None
    username = request.form.get('username', '').strip()
    if request.method == 'POST':
        password = request.form.get('password', '')
        if not username or len(username) > 80:
            error = 'Username must contain 1–80 characters.'
        elif len(password) < 8:
            error = 'Password must contain at least 8 characters.'
        else:
            try:
                with database() as db:
                    cursor = db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id', (username, generate_password_hash(password)))
                    user_id = cursor.fetchone()['id']
            except (sqlite3.IntegrityError, psycopg.IntegrityError):
                error = 'That username is already taken.'
            else:
                session.clear()
                session['user_id'] = user_id
                session['username'] = username
                return redirect('/forum' if request.args.get('next') == '/forum' else url_for('account'))
    return render_template('register.html', error=error, username=username)


@app.route('/account')
def account():
    if not session.get('user_id'):
        return redirect(url_for('login'))
    return render_template('account.html')


@app.post('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))


@app.get('/world')
def world():
    saved = None
    if session.get('user_id'):
        with database() as db:
            row = db.execute('SELECT * FROM game_saves WHERE user_id = ?', (session['user_id'],)).fetchone()
            saved = dict(row) if row else None
    return render_template('world.html', saved_game=saved)


def pet_progress(saved):
    saved = dict(saved) if saved else {}
    xp = saved.get('dog_xp', 0)
    return {'food': saved.get('dog_food', 0), 'xp': xp, 'level': min(100, xp // 100),
            'claims': json.loads(saved.get('food_claims', '{}'))}



def saved_animals(saved):
    pets=json.loads(saved.get('animal_pets','{}')) if saved else {}
    kind=pets.get('riding')
    if kind=='Dog':
        allowed=bool(saved.get('dog_name')) and saved.get('dog_xp',0)>=500
    else:
        info=pets.get(kind) if isinstance(kind,str) else None
        allowed=bool(info) and pets.get('active')==kind and info.get('xp',0)>=500
    if kind and not allowed:
        pets['riding']=None
    return pets


@app.post('/api/world/join')
def join_world():
    data = request.get_json(silent=True) or {}
    nickname = data.get('nickname', '')
    if not isinstance(nickname, str) or not 1 <= len(nickname.strip()) <= 24:
        return {'error': 'Enter a nickname of 1–24 characters.'}, 400
    nickname = nickname.strip()
    chosen_avatar = data.get('avatar')
    if chosen_avatar is not None and (not isinstance(chosen_avatar, str) or not re.fullmatch(r'r2-\d{3}', chosen_avatar) or int(chosen_avatar[3:]) >= 94):
        return {'error': '请选择有效的角色皮肤。'}, 400
    player_id = secrets.token_urlsafe(24)
    session['world_players'] = (session.get('world_players', []) + [player_id])[-12:]
    session['world_player'] = player_id
    with database() as db:
        user_id = session.get('user_id')
        saved = db.execute('SELECT * FROM game_saves WHERE user_id = ?', (user_id,)).fetchone() if user_id else None
        room_open=bool(db.execute("SELECT value FROM world_objects WHERE name='room-door'").fetchone()['value'])
        state = dict(saved) if saved else {'x': 70.4, 'z': -132.8, 'yaw': .7853981634, 'pitch': 0, 'music_muted': 0, 'avatar': secrets.choice(['01m', '02m', '01f', '02f'])}
        if chosen_avatar is not None:
            state['avatar'] = chosen_avatar
        db.execute('INSERT INTO players (id, nickname, x, z, yaw, updated, avatar, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', (player_id, nickname, state['x'], state['z'], state['yaw'], time.time(), state['avatar'], user_id))
        if user_id:
            db.execute("""INSERT INTO game_saves (user_id, nickname, avatar, x, z, yaw, pitch, music_muted, updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET nickname = excluded.nickname, avatar = excluded.avatar""",
                (user_id, nickname, state['avatar'], state['x'], state['z'], state['yaw'], state['pitch'], state['music_muted'], time.time()))
    session['world_message_at'] = 0
    return {'room_open':room_open,'id': player_id, 'nickname': nickname, 'persistent': bool(user_id), 'animals':saved_animals(state), 'pet': pet_progress(state), 'dog_name': state.get('dog_name', ''), 'server_time': time.time(), 'state': {k: state[k] for k in ('x', 'z', 'yaw', 'pitch', 'avatar', 'music_muted')}}


def world_player_id(data):
    player_id = data.get('player_id', session.get('world_player', ''))
    if not isinstance(player_id, str) or player_id not in session.get('world_players', []):
        abort(401)
    return player_id


@app.post('/api/world/state')
def world_state():
    data = request.get_json(silent=True) or {}
    player_id = world_player_id(data)
    coordinates = [data.get('x', 0), data.get('z', 0)]
    yaw = data.get('yaw', 0)
    jump = data.get('jump', 0)
    running = data.get('running', False)
    pitch = data.get('pitch', 0)
    music_muted = data.get('music_muted', False)
    if isinstance(pitch, bool) or not isinstance(pitch, (int, float)) or not math.isfinite(pitch) or not -.7 <= pitch <= .7 or not isinstance(music_muted, bool):
        return {'error': 'Invalid settings.'}, 400
    if isinstance(jump, bool) or not isinstance(jump, (int, float)) or not math.isfinite(jump) or not 0 <= jump <= 3 or not isinstance(running, bool):
        return {'error': 'Invalid movement.'}, 400
    if isinstance(yaw, bool) or not isinstance(yaw, (int, float)) or not math.isfinite(yaw):
        return {'error': 'Invalid orientation.'}, 400
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 10000 for v in coordinates):
        return {'error': 'Invalid position.'}, 400
    with database() as db:
        player = db.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
        if not player or player['user_id'] != session.get('user_id'):
            return {'error': 'Join the world first.'}, 401
        db.execute('UPDATE players SET x = ?, z = ?, yaw = ?, jump = ?, running = ?, updated = ? WHERE id = ?', (*coordinates, yaw, jump, int(running), time.time(), player['id']))
        if player['user_id']:
            db.execute('UPDATE game_saves SET x = ?, z = ?, yaw = ?, pitch = ?, music_muted = ?, updated = ? WHERE user_id = ?',
                       (*coordinates, yaw, pitch, int(music_muted), time.time(), player['user_id']))
        db.execute('DELETE FROM players WHERE updated < ?', (time.time() - 30,))
        players = [dict(row) for row in db.execute("SELECT p.id, p.nickname, p.x, p.z, p.yaw, p.avatar, p.jump, p.running, COALESCE(s.dog_name, '') AS dog_name, COALESCE(s.dog_xp, 0) AS dog_xp, COALESCE(s.animal_pets, '{}') AS animal_pets FROM players p LEFT JOIN game_saves s ON s.user_id=p.user_id WHERE p.id != ?", (player['id'],))]
        messages = [dict(row) for row in db.execute('SELECT id, nickname, body FROM messages ORDER BY id DESC LIMIT 40')][::-1]
        pet = db.execute('SELECT * FROM game_saves WHERE user_id = ?', (player['user_id'],)).fetchone() if player['user_id'] else None
        room_open=bool(db.execute("SELECT value FROM world_objects WHERE name='room-door'").fetchone()['value'])
    for peer in players:
        pets=json.loads(peer.pop('animal_pets'));kind=pets.get('active');info=pets.get(kind) if kind else None
        peer['animals']={'active':kind,kind:{'name':info['name'],'xp':info['xp']}} if info else {}
        ride=pets.get('riding')
        peer['riding']=ride if (ride=='Dog' and peer['dog_name'] and peer['dog_xp']>=500) or (ride==kind and info and info['xp']>=500) else None
    return {'version':APP_VERSION,'room_open':room_open,'animals':saved_animals(dict(pet)) if pet else {},'players': players, 'messages': messages, 'pet': pet_progress(pet), 'dog_name': pet['dog_name'] if pet else '', 'server_time': time.time()}



@app.post('/api/world/mount')
def mount_pet():
    data=request.get_json(silent=True) or {}
    if not isinstance(data,dict):
        return {'error':'操作格式不正确。'},400
    player_id=world_player_id(data)
    uid=session.get('user_id')
    if not uid:
        return {'error':'登录并领养宠物后才能骑乘。'},401
    kind=data.get('kind')
    if kind is not None and kind not in ('Dog','Cow','Horse','Llama','Pig','Pug','Sheep','Zebra'):
        return {'error':'请选择已领养的宠物。'},400
    with database() as db:
        player=db.execute('SELECT * FROM players WHERE id=?',(player_id,)).fetchone()
        if not player or player['user_id']!=uid:
            return {'error':'请先进入村庄。'},401
        saved=db.execute('SELECT * FROM game_saves WHERE user_id=?',(uid,)).fetchone()
        if not saved:
            return {'error':'账户存档尚未准备好。'},409
        pets=json.loads(saved['animal_pets'])
        if kind=='Dog' and not saved['dog_name'] or kind and kind!='Dog' and not pets.get(kind):
            return {'error':'只能骑乘自己已领养的宠物。'},400
        xp=saved['dog_xp'] if kind=='Dog' else pets.get(kind,{}).get('xp',0) if kind else 500
        if kind and xp < 500:
            return {'error':'宠物达到 Lv.5 后才能骑乘。'},400
        pets['riding']=kind
        if kind and kind!='Dog':
            pets['active']=kind
        changed=db.execute('UPDATE game_saves SET animal_pets=? WHERE user_id=? AND animal_pets=? RETURNING user_id',
            (json.dumps(pets,ensure_ascii=False),uid,saved['animal_pets'])).fetchone()
        if not changed:
            return {'error':'存档刚刚更新，请再试一次。'},409
    return {'animals':pets,'message':'已骑上宠物。' if kind else '已下骑。'}


@app.post('/api/world/room-door')
def room_door():
    data=request.get_json(silent=True) or {}
    player_id=world_player_id(data)
    with database() as db:
        player=db.execute('SELECT * FROM players WHERE id=?',(player_id,)).fetchone()
        if not player or player['user_id']!=session.get('user_id'):
            return {'error':'请先进入村庄。'},401
        if math.hypot(player['x']-58,player['z']+129)<3:
            row=db.execute("UPDATE world_objects SET value=CASE WHEN value=0 THEN 1 ELSE 0 END WHERE name='room-door' RETURNING value").fetchone()
        else:
            return {'error':'走近房门再开关门。'},400
    return {'room_open':bool(row['value'])}


@app.post('/api/world/dog')
def adopt_dog():
    data = request.get_json(silent=True) or {}
    player_id = world_player_id(data)
    user_id = session.get('user_id')
    if not user_id:
        return {'error': '请先登录账户，才能领养并保存狗。'}, 401
    name = data.get('name', '')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 24:
        return {'error': '请输入 1–24 个字符的名字。'}, 400
    with database() as db:
        player = db.execute('SELECT user_id FROM players WHERE id = ?', (player_id,)).fetchone()
        if not player or player['user_id'] != user_id:
            return {'error': '请先进入世界。'}, 401
        # Account identity comes only from the authenticated session. Updating
        # this one field cannot overwrite position or another account's pet.
        db.execute('UPDATE game_saves SET dog_name = ? WHERE user_id = ?', (name.strip(), user_id))
    return {'dog_name': name.strip()}


@app.post('/api/world/pet-action')
def pet_action():
    data = request.get_json(silent=True) or {}
    player_id = world_player_id(data)
    uid = session.get('user_id')
    if not uid:
        return {'error': '请先登录，才能保存狗粮和养成进度。'}, 401
    action = data.get('action')
    now = time.time()
    with database() as db:
        player = db.execute('SELECT * FROM players WHERE id=?', (player_id,)).fetchone()
        if not player or player['user_id'] != uid:
            return {'error': '请先进入世界。'}, 401
        saved = db.execute('SELECT * FROM game_saves WHERE user_id=?', (uid,)).fetchone()
        if action == 'collect':
            spot = next((p for p in json.loads((BASE_DIR / 'static/food-spots.json').read_text()) if p['id'] == data.get('spot')), None)
            if not spot or math.hypot(player['x']-spot['x'], player['z']-spot['z']) > 3:
                return {'error': '走近有食物的草丛再采集。'}, 400
            claims = json.loads(saved['food_claims'])
            if now - claims.get(spot['id'], 0) < 120:
                return {'error': '这处食物正在补充，稍后再来。'}, 429
            claims[spot['id']] = now
            changed = db.execute('UPDATE game_saves SET dog_food=dog_food+3, food_claims=? WHERE user_id=? AND food_claims=? RETURNING user_id', (json.dumps(claims), uid, saved['food_claims'])).fetchone()
            if not changed:
                return {'error': '食物刚刚已采集，请稍后重试。'}, 409
            message = '采集到 3 份狗粮'
        elif action in ('feed', 'pet', 'call'):
            if not saved['dog_name']:
                return {'error': '先领养一只狗吧。'}, 400
            if now - saved['dog_interaction_at'] < 5:
                return {'error': '让狗缓一缓，5 秒后再互动。'}, 429
            if action == 'feed' and saved['dog_food'] < 1:
                return {'error': '狗粮不足，去有食物的草丛采集吧。'}, 400
            cost = 1 if action == 'feed' else 0
            reward = 25 if action == 'feed' else 5 if action == 'pet' else 0
            changed = db.execute('UPDATE game_saves SET dog_food=dog_food-?, dog_xp=CASE WHEN dog_xp+? > 10000 THEN 10000 ELSE dog_xp+? END, dog_interaction_at=? WHERE user_id=? AND dog_interaction_at<=? AND dog_food>=? RETURNING user_id', (cost,reward,reward,now,uid,now-5,cost)).fetchone()
            if not changed:
                latest = db.execute('SELECT dog_food FROM game_saves WHERE user_id=?', (uid,)).fetchone()
                if action == 'feed' and latest['dog_food'] < cost:
                    return {'error': '狗粮不足，去有食物的草丛采集吧。'}, 400
                return {'error': '让狗缓一缓，5 秒后再互动。'}, 429
            message = {'feed':'喂食成功 · +25 经验', 'pet':'狗开心地摇尾巴 · +5 经验', 'call':'狗听见你在呼唤它'}[action]
        else:
            return {'error': '未知互动。'}, 400
        updated = db.execute('SELECT * FROM game_saves WHERE user_id=?', (uid,)).fetchone()
    return {'pet': pet_progress(updated), 'message': message, 'action': action}


@app.post('/api/world/chat')
def world_chat():
    data = request.get_json(silent=True) or {}
    player_id = world_player_id(data)
    body = data.get('message', '')
    if not isinstance(body, str) or not 1 <= len(body.strip()) <= 2000:
        return {'error': 'Messages must contain 1–2000 characters.'}, 400
    if time.time() - session.get('world_message_at', 0) < 1:
        return {'error': 'Please wait a moment.'}, 429
    with database() as db:
        player = db.execute('SELECT nickname FROM players WHERE id = ?', (player_id,)).fetchone()
        if not player:
            return {'error': 'Join the world first.'}, 401
        db.execute('INSERT INTO messages (nickname, body, created) VALUES (?, ?, ?)', (player['nickname'], body, time.time()))
        db.execute('DELETE FROM messages WHERE id < (SELECT COALESCE(MAX(id), 0) - 200 FROM messages)')
    session['world_message_at'] = time.time()
    return {'ok': True}


@app.post('/api/world/leave')
def leave_world():
    player_id = world_player_id(request.get_json(silent=True) or {})
    with database() as db:
        db.execute('DELETE FROM players WHERE id = ?', (player_id,))
    return {'ok': True}


@app.cli.command('import-sqlite')
@click.argument('source', type=click.Path(exists=True, path_type=Path))
def import_sqlite(source):
    """Import accounts and saves from a private SQLite backup into an empty PostgreSQL database."""
    if not app.config['DATABASE_URL']:
        raise click.ClickException('Set DATABASE_URL first.')
    local = sqlite3.connect(f'file:{source.resolve()}?mode=ro', uri=True)
    local.row_factory = sqlite3.Row
    try:
        users = local.execute('SELECT id, username, password_hash FROM users').fetchall()
        tables = {row[0] for row in local.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        saves = local.execute('SELECT * FROM game_saves').fetchall() if 'game_saves' in tables else []
        with database() as db:
            if db.execute('SELECT COUNT(*) AS count FROM users').fetchone()['count']:
                raise click.ClickException('Target already contains accounts; import stopped without changing them.')
            for user in users:
                db.execute('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)', tuple(user))
            for save in saves:
                keys = ('user_id','nickname','avatar','x','z','yaw','pitch','music_muted','updated','save_version')
                db.execute('INSERT INTO game_saves (' + ','.join(keys) + ') VALUES (' + ','.join('?' for _ in keys) + ')', tuple(save[k] for k in keys))
            db.execute("SELECT setval(pg_get_serial_sequence('game.users','id'), COALESCE(MAX(id),1), COUNT(*)>0) FROM users")
    finally:
        local.close()
    click.echo(f'Imported {len(users)} accounts and {len(saves)} saves.')


@app.cli.command('backup-database')
@click.argument('destination', type=click.Path(path_type=Path))
def backup_database(destination):
    """Create a consistent backup without overwriting an existing backup."""
    if app.config['DATABASE_URL']:
        raise click.ClickException('Use pg_dump for PostgreSQL backups; this command backs up SQLite only.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open('xb'):
            pass
    except FileExistsError:
        raise click.ClickException('Backup already exists; choose a new filename.') from None
    try:
        with database() as source:
            target = sqlite3.connect(destination)
            try:
                source.backup(target)
            finally:
                target.close()
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    click.echo(f'Backup saved: {destination}')


@app.cli.command('create-user')
@click.argument('username')
@click.password_option(confirmation_prompt=True)
def create_user(username, password):
    """Create an account; passwords are entered privately and stored as hashes."""
    username = username.strip()
    if not username or len(username) > 80:
        raise click.ClickException('Username must contain 1–80 characters.')
    if len(password) < 8:
        raise click.ClickException('Password must contain at least 8 characters.')
    try:
        with database() as db:
            db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, generate_password_hash(password)))
    except (sqlite3.IntegrityError, psycopg.IntegrityError):
        raise click.ClickException('That username already exists.') from None
    click.echo(f'Created account: {username}')


from animals import install_animals
install_animals(app,database,world_player_id,pet_progress)

from forum import install_forum
install_forum(app, database)

if __name__ == '__main__':
    app.run()

