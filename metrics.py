"""History for the Overview graphs: CPU, memory, disk and network, sampled once a minute.

A background thread in the panel records one row per minute in the panel database and keeps seven
days. Gaps are real: while the panel is stopped (or the machine is off) nothing is recorded, and the
graphs show a break instead of inventing values. The CPU figure is computed here from the kernel's
cumulative counters, separately from the live Overview card, so the two never disturb each other.
"""
import threading, time
import psutil
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user
import store

router = APIRouter(prefix="/api/metrics")

INTERVAL = 60                      # seconds between samples
KEEP = 7 * 86400                   # how long samples are kept
RANGES = {"1h": 3600, "6h": 6 * 3600, "24h": 86400, "7d": 7 * 86400}
POINTS = 240                       # about this many points are returned, whatever the range

with store._lock:
    store._conn.execute("CREATE TABLE IF NOT EXISTS metrics ("
                        "ts INTEGER PRIMARY KEY, cpu REAL, mem REAL, disk REAL, rx REAL, tx REAL)")
    store._conn.commit()


def _cpu_times():
    t = psutil.cpu_times()
    total = sum(t)
    idle = t.idle + getattr(t, "iowait", 0)
    return total, idle


def _net_bytes():
    rx = tx = 0
    for name, c in psutil.net_io_counters(pernic=True).items():
        if name != "lo":
            rx += c.bytes_recv
            tx += c.bytes_sent
    return rx, tx


class Sampler:
    def __init__(self):
        self.cpu = _cpu_times()
        self.net = _net_bytes()
        self.at = time.time()

    def take(self):
        """One reading. Rates cover the time since the previous reading."""
        now = time.time()
        total, idle = _cpu_times()
        dt = max(now - self.at, 1e-3)
        dtotal = total - self.cpu[0]
        cpu = None if dtotal <= 0 else max(0.0, min(100.0, 100.0 * (1 - (idle - self.cpu[1]) / dtotal)))
        rx, tx = _net_bytes()
        drx, dtx = rx - self.net[0], tx - self.net[1]
        self.cpu, self.net, self.at = (total, idle), (rx, tx), now
        if drx < 0 or dtx < 0:          # counters restarted
            drx = dtx = 0
        try:
            disk = psutil.disk_usage("/").percent
        except OSError:
            disk = None
        return {"ts": int(now), "cpu": cpu, "mem": psutil.virtual_memory().percent, "disk": disk,
                "rx": drx / dt, "tx": dtx / dt}


def record(row):
    with store._lock:
        store._conn.execute("INSERT OR REPLACE INTO metrics (ts, cpu, mem, disk, rx, tx) VALUES (?,?,?,?,?,?)",
                            (row["ts"], row["cpu"], row["mem"], row["disk"], row["rx"], row["tx"]))
        store._conn.execute("DELETE FROM metrics WHERE ts < ?", (row["ts"] - KEEP,))
        store._conn.commit()


def series(seconds, now=None):
    now = int(now or time.time())
    bucket = max(INTERVAL, (seconds // POINTS) // INTERVAL * INTERVAL)
    with store._lock:
        rows = store._conn.execute(
            "SELECT (ts / ?) * ? AS t, AVG(cpu), AVG(mem), AVG(disk), AVG(rx), AVG(tx) FROM metrics "
            "WHERE ts >= ? GROUP BY t ORDER BY t", (bucket, bucket, now - seconds)).fetchall()
    r = lambda v, n: None if v is None else round(v, n)
    return bucket, [{"t": t, "cpu": r(c, 1), "mem": r(m, 1), "disk": r(d, 1), "rx": r(rx, 0), "tx": r(tx, 0)}
                    for t, c, m, d, rx, tx in rows]


@router.get("")
def history(rng: str = "1h", user: str = Depends(current_user)):
    if rng not in RANGES:
        raise HTTPException(400, "Invalid range")
    step, points = series(RANGES[rng])
    return {"step": step, "points": points}


def _loop():
    s = Sampler()
    time.sleep(10)
    while True:
        try:
            record(s.take())
        except Exception:                # never let the sampler die
            pass
        time.sleep(INTERVAL)


def start():
    threading.Thread(target=_loop, name="metrics", daemon=True).start()
