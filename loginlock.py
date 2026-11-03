"""Failed-sign-in counter shared by the File manager and the Terminal.

Both pages sign in to Linux accounts over SSH, so both draw on the same budget:
5 failures in 5 minutes per (client address, panel user), kept in SQLite so a
restart does not reset it. The namespace is the one fs.py always used, so
counters carry over when you upgrade.
"""
import time
from store import PersistentDict

MAX_FAILS, WINDOW = 5, 300
fails = PersistentDict("fs_fail", expires_at=lambda v: v[1] + WINDOW)


def key(ip, panel_user):
    return f"{ip}:{panel_user}"


def locked(k):
    rec = fails.get(k)
    return bool(rec and time.time() - rec[1] <= WINDOW and rec[0] >= MAX_FAILS)


def record_failure(k, n=1):
    count, first = fails.get(k, (0, time.time()))
    fails[k] = (count + n, first)


def clear(k):
    fails.pop(k, None)
