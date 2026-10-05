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
    secret_path = BASE_DIR / 'instance' / 'secret.key'
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
    return render_template('world.html')


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
        db.execute('INSERT OR REPLACE INTO players (id, nickname, x, z, updated) VALUES (?, ?, 0, 0, ?)', (session['world_player'], nickname, time.time()))
    session['world_message_at'] = 0
    return {'id': session['world_player'], 'nickname': nickname}


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
    if isinstance(yaw, bool) or not isinstance(yaw, (int, float)) or not math.isfinite(yaw):
        return {'error': 'Invalid orientation.'}, 400
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 10000 for v in coordinates):
        return {'error': 'Invalid position.'}, 400
    with database() as db:
        player = db.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
        if not player:
            return {'error': 'Join the world first.'}, 401
        db.execute('UPDATE players SET x = ?, z = ?, yaw = ?, updated = ? WHERE id = ?', (*coordinates, yaw, time.time(), player['id']))
        db.execute('DELETE FROM players WHERE updated < ?', (time.time() - 30,))
        players = [dict(row) for row in db.execute('SELECT id, nickname, x, z, yaw FROM players WHERE id != ?', (player['id'],))]
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
