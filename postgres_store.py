"""Private PostgreSQL storage for the Flask backend; no browser database keys."""
import atexit
from contextlib import contextmanager
from pathlib import Path
from threading import Lock

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool = None
_lock = Lock()

class Connection:
    def __init__(self, raw):
        self.raw = raw
    def execute(self, query, parameters=()):
        # Application queries use SQLite-style placeholders; values remain bound.
        return self.raw.execute(query.replace('?', '%s'), parameters)

@contextmanager
def database(url):
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                pool = ConnectionPool(url, min_size=1, max_size=4, timeout=10,
                    kwargs={'row_factory':dict_row, 'sslmode':'require', 'connect_timeout':10, 'prepare_threshold':None}, open=True)
                try:
                    with pool.connection() as connection:
                        # Serialize additive schema setup across Gunicorn workers.
                        connection.execute('SELECT pg_advisory_xact_lock(194730102)')
                        connection.execute(Path(__file__).with_name('postgres_schema.sql').read_text(), prepare=False)
                except Exception:
                    pool.close()
                    raise
                atexit.register(pool.close)
                _pool = pool
    with _pool.connection() as connection:
        connection.execute('SET LOCAL search_path TO game, pg_catalog')
        yield Connection(connection)
