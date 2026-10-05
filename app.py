import os
import secrets
import sqlite3
import math
import time
from pathlib import Path
from contextlib import contextmanager

import click
from flask import Flask, abort, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=str(BASE_DIR / 'templates'))
app.config.update(
    DATABASE=os.environ.get('DATABASE_PATH', str(BASE_DIR / 'instance' / 'users.sqlite3')),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('COOKIE_SECURE') == '1',
    MAX_CONTENT_LENGTH=16 * 1024,
)
# Persist the local secret so sessions survive restarts. Set SECRET_KEY in production.
secret = os.environ.get('SECRET_KEY')
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


@contextmanager
def database():
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(app.config['DATABASE'])
    connection.row_factory = sqlite3.Row
    connection.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)')
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
    connection.execute('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL)')
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
    return {'csrf_token': session['csrf_token']}


@app.before_request
def check_csrf():
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
        return redirect(url_for('account'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()[:80]
        password = request.form.get('password', '')
        with database() as db:
            attempt = db.execute("SELECT * FROM login_attempts WHERE username = ? AND last_attempt > unixepoch() - 900", (username,)).fetchone()
            if attempt and attempt['failures'] >= 10:
                return render_template('login.html', error='Too many attempts. Try again in 15 minutes.', username=username), 429
            user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            valid = check_password_hash(user['password_hash'] if user else DUMMY_HASH, password)
            if user and valid:
                db.execute('DELETE FROM login_attempts WHERE username = ?', (username,))
                session.clear()
                session['user_id'] = user['id']
                session['username'] = user['username']
                return redirect(url_for('account'))
            db.execute("INSERT INTO login_attempts VALUES (?, 1, unixepoch()) ON CONFLICT(username) DO UPDATE SET failures = CASE WHEN last_attempt > unixepoch() - 900 THEN failures + 1 ELSE 1 END, last_attempt = unixepoch()", (username,))
        error = 'Incorrect username or password.'
    return render_template('login.html', error=error, username=request.form.get('username', ''))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if session.get('user_id'):
        return redirect(url_for('account'))
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
                    cursor = db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, generate_password_hash(password)))
                    user_id = cursor.lastrowid
            except sqlite3.IntegrityError:
                error = 'That username is already taken.'
            else:
                session.clear()
                session['user_id'] = user_id
                session['username'] = username
                return redirect(url_for('account'))
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


@app.post('/api/world/join')
def join_world():
    data = request.get_json(silent=True) or {}
    nickname = data.get('nickname', '')
    if not isinstance(nickname, str) or not 1 <= len(nickname.strip()) <= 24:
        return {'error': 'Enter a nickname of 1–24 characters.'}, 400
    nickname = nickname.strip()
    player_id = secrets.token_urlsafe(24)
    session['world_players'] = (session.get('world_players', []) + [player_id])[-12:]
    session['world_player'] = player_id
    with database() as db:
        user_id = session.get('user_id')
        saved = db.execute('SELECT * FROM game_saves WHERE user_id = ?', (user_id,)).fetchone() if user_id else None
        state = dict(saved) if saved else {'x': 70.4, 'z': -132.8, 'yaw': .7853981634, 'pitch': 0, 'music_muted': 0, 'avatar': secrets.choice(['01m', '02m', '01f', '02f'])}
        db.execute('INSERT INTO players (id, nickname, x, z, yaw, updated, avatar, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', (player_id, nickname, state['x'], state['z'], state['yaw'], time.time(), state['avatar'], user_id))
        if user_id:
            db.execute("""INSERT INTO game_saves (user_id, nickname, avatar, x, z, yaw, pitch, music_muted, updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET nickname = excluded.nickname""",
                (user_id, nickname, state['avatar'], state['x'], state['z'], state['yaw'], state['pitch'], state['music_muted'], time.time()))
    session['world_message_at'] = 0
    return {'id': player_id, 'nickname': nickname, 'persistent': bool(user_id), 'state': {k: state[k] for k in ('x', 'z', 'yaw', 'pitch', 'avatar', 'music_muted')}}


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
        players = [dict(row) for row in db.execute('SELECT id, nickname, x, z, yaw, avatar, jump, running FROM players WHERE id != ?', (player['id'],))]
        messages = [dict(row) for row in db.execute('SELECT id, nickname, body FROM messages ORDER BY id DESC LIMIT 40')][::-1]
    return {'players': players, 'messages': messages}


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


@app.cli.command('backup-database')
@click.argument('destination', type=click.Path(path_type=Path))
def backup_database(destination):
    """Create a consistent backup without overwriting an existing backup."""
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
    except sqlite3.IntegrityError:
        raise click.ClickException('That username already exists.') from None
    click.echo(f'Created account: {username}')


if __name__ == '__main__':
    app.run()
