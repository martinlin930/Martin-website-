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

## Supabase on free Render

Set `DATABASE_URL` to the Supabase session pooler PostgreSQL URI (port 5432), with the database password percent-encoded. Set a stable random `SECRET_KEY` and `COOKIE_SECURE=1` in Render Environment. Keep credentials out of the repository and browser scripts. PostgreSQL connection failure never falls back to temporary SQLite storage.

App tables use the private `game` schema, with RLS enabled and no access granted to browser `anon`/`authenticated` roles. The Flask backend manages username/password login and account ownership; Supabase Auth or social login is not required. The server connects using the project's database credentials over TLS and a bounded connection pool. Schema creation is additive and protected by a transaction advisory lock.

Before switching, preserve any accessible old SQLite database. To import a private local backup into an **empty** Supabase application database, run `flask --app app import-sqlite /path/to/users.sqlite3` with `DATABASE_URL` and `SECRET_KEY` configured privately. This preserves IDs, existing password hashes and account saves without resetting passwords. A nonempty target is rejected. Online player presence and rolling chat are not imported. If an old free Render instance's ephemeral database has already disappeared or cannot be exported, it cannot be recovered from the GitHub repository.

Use `pg_dump` for independent PostgreSQL backups. Free services have limits and may pause with inactivity; an update retains data in the same Supabase project, but the free plan is not a promise of perpetual availability.

## Shared day/night cycle

One in-game day lasts 24 real minutes: 06:00–18:00 is daylight (12 real minutes), and 18:00–06:00 is night (12 real minutes). The phase comes from server Unix time, so reconnects and deploys do not restart the shared clock. Night sky is deep blue; sunlight, ambient light, fog and environment reflections fade at dawn and dusk. Run `node tests/day-night.mjs` to verify duration and phase boundaries.

## Village dogs

Six Beagles wander near the village entrance, alternating walking, running and resting with procedural leg, head and tail movement. Their closed paths are checked against terrain and building collision, and server time keeps their positions consistent between players. Model: user-provided **Beagle by Poly by Google** (`static/models/dogs/beagle.glb`), with its original texture retained. Run `node tests/dogs.mjs` to verify ground support, safe routes, continuous movement and shared timing.

### Adopt a companion

Sign in, approach a village dog within 3 metres, then click **领养这只狗** and enter a name (1–24 Unicode characters). Each account has one Beagle companion, which follows the owner's route on the ground; its name floats above it and is visible to other players. Use the pet button to rename it. Visitors must sign in to adopt. The pet name is stored in `game_saves.dog_name` using an additive migration; leaving, logging out or deploying does not erase it. Rejoining restores the companion beside its owner. Names are rendered as text, and adoption/renaming updates only the authenticated account's save.
