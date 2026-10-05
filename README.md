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
