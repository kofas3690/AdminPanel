"""Where the panel keeps what it writes.

The program files are owned by root and the panel account cannot change them. Everything the panel
saves (administrators, sessions, the audit log) lives in one folder it can write to. In the installed
package that is /opt/adminpanel/data; ADMINPANEL_DATA points somewhere else (development, tests).
"""
import os
from pathlib import Path

DATA = Path(os.environ.get("ADMINPANEL_DATA", Path(__file__).resolve().parent / "data"))
try:
    DATA.mkdir(mode=0o700, exist_ok=True)
except OSError:
    pass          # a read-only copy of the program (for example the selfcheck run as another user)

USERS_FILE = DATA / "users.json"
AUDIT_FILE = DATA / "audit.log"
DB_FILE = DATA / "panel.db"
