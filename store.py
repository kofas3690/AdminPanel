import hashlib, json, os, sqlite3, threading, time
from pathlib import Path

DB_PATH = Path(os.environ.get("PANEL_DB", Path(__file__).parent / "panel.db"))

os.close(os.open(DB_PATH, os.O_CREAT | os.O_RDWR, 0o600))
_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_lock = threading.Lock()
_conn.execute(
    "CREATE TABLE IF NOT EXISTS kv ("
    "ns TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, exp REAL, "
    "PRIMARY KEY (ns, k))"
)
_conn.execute("CREATE INDEX IF NOT EXISTS kv_exp ON kv (exp)")
_conn.commit()


class PersistentDict:
    """A dictionary-like store that lives in SQLite.

    expires_at(value) -> absolute unix time after which a row disappears.
    hash_keys=True stores only a SHA-256 of each key (used for session tokens).
    Values are saved as JSON, so tuples come back as lists.
    """

    def __init__(self, ns, hash_keys=False, expires_at=None):
        self.ns = ns
        self.hash_keys = hash_keys
        self.expires_at = expires_at

    def _k(self, key):
        key = str(key)
        return hashlib.sha256(key.encode()).hexdigest() if self.hash_keys else key

    def stored_key(self, key):
        return self._k(key)

    def get(self, key, default=None):
        if key is None:
            return default
        with _lock:
            row = _conn.execute(
                "SELECT v FROM kv WHERE ns=? AND k=? AND (exp IS NULL OR exp>?)",
                (self.ns, self._k(key), time.time()),
            ).fetchone()
        return json.loads(row[0]) if row else default

    def items(self):
        with _lock:
            rows = _conn.execute(
                "SELECT k, v FROM kv WHERE ns=? AND (exp IS NULL OR exp>?)",
                (self.ns, time.time()),
            ).fetchall()
        return [(k, json.loads(v)) for k, v in rows]

    def __setitem__(self, key, value):
        exp = self.expires_at(value) if self.expires_at else None
        with _lock:
            _conn.execute("DELETE FROM kv WHERE exp IS NOT NULL AND exp<?", (time.time(),))
            _conn.execute(
                "INSERT OR REPLACE INTO kv (ns, k, v, exp) VALUES (?,?,?,?)",
                (self.ns, self._k(key), json.dumps(value), exp),
            )
            _conn.commit()

    def pop(self, key, default=None):
        if key is None:
            return default
        with _lock:
            row = _conn.execute(
                "SELECT v FROM kv WHERE ns=? AND k=?", (self.ns, self._k(key))
            ).fetchone()
            _conn.execute("DELETE FROM kv WHERE ns=? AND k=?", (self.ns, self._k(key)))
            _conn.commit()
        return json.loads(row[0]) if row else default

    def delete_raw(self, stored):
        with _lock:
            _conn.execute("DELETE FROM kv WHERE ns=? AND k=?", (self.ns, stored))
            _conn.commit()

    def __delitem__(self, key):
        self.pop(key)
