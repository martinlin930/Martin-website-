# Martin Photography

Flask photography portfolio with username/password authentication. Home and work pages are public; `/account` requires login. Visitors can register at `/register` using just a username and password. No social login or email is required. Registration signs the visitor in automatically.

## Run locally

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app app create-user martin
flask --app app run
```

The create-user command privately prompts for a password and confirmation (minimum 8 characters). Visitors can also create their own accounts at `/register`. Visit `/login` to sign in. Passwords are stored as salted scrypt hashes in `instance/users.sqlite3`. Login and logout forms use CSRF protection. Ten failed attempts for a username temporarily block further attempts for 15 minutes.

## Hosting

Run `gunicorn app:app`. Set a long random `SECRET_KEY` and `COOKIE_SECURE=1` when serving over HTTPS. Use `DATABASE_PATH` to point to a persistent SQLite volume, and back it up. All workers must share the same secret and database. The default local secret is saved in `instance/secret.key`; keep the instance directory private and out of version control. Use the create-user command on the host to provision accounts.

## Village account saves

Logged-in players automatically save nickname, avatar, position, horizontal/vertical viewing direction and music mute preference in `game_saves`, keyed by account ID. Join restores this state even from another device. Visitors remain temporary. Jumping/running are transient actions and restart grounded. Online presence expires after 30 seconds independently of saves. Public chat is a shared rolling history, not a private account archive.

Database initialization is additive (`CREATE TABLE IF NOT EXISTS` and missing-column `ALTER TABLE`); redeploys never reset the accounts or saves. Keep the database out of Git. Future gameplay features must store their permanent state with the account and migrate existing records instead of replacing them.

### Render persistent storage

The existing Render service must have a persistent disk. Only files under its Mount Path survive redeploys. For example, with Mount Path `/var/data`, set `DATABASE_PATH=/var/data/users.sqlite3`. If the disk has another mount path, use that actual path. Keep the existing `SECRET_KEY` unchanged. Without it, the fallback secret is saved alongside the database. Do not create another service or replace the existing disk during updates.

If existing accounts are stored outside the disk, copy the old SQLite database to the persistent location **before** changing `DATABASE_PATH` or redeploying, using SQLite's backup API while the old service is still running. Preserve the existing database instead of initializing an empty replacement. Keep independent database backups; persistent storage preserves deploys but does not replace backups.

Run `flask --app app backup-database /var/data/backups/users-YYYY-MM-DD.sqlite3` from the running service's Shell to create a consistent SQLite backup. Download important backups to a separate location. Do not commit databases or backups to GitHub. Disk configuration must be verified in the Render dashboard; repository code alone cannot attach or verify a disk.

### Controls and tests

Desktop: WASD/arrows, Shift to run, Space to jump, drag/click to look, Enter to chat. Mobile: drag the joystick, push fully to run, tap Jump, drag to look. Village music loops while inside and stops on exit. Other players' positions, avatar orientation, running and jumping are synchronized.

Run `python -m unittest discover -s tests` for authentication, multiplayer and save isolation/restoration/migration tests; run `node tests/village_collision.mjs` for stair surface checks against the actual map geometry.
