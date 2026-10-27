import asyncio, fcntl, json, os, pty, re, struct, termios, time
from pathlib import Path
from fastapi import APIRouter, WebSocket
from audit import audit
from logs import ws_user, origin_ok

router = APIRouter()

SSH = "/usr/bin/ssh"
SETSID = "/usr/bin/setsid"
KNOWN_HOSTS = Path(__file__).parent / "ssh_known_hosts"
ENV = {"PATH": "/usr/bin:/bin", "TERM": "xterm-256color",
       "HOME": str(Path(__file__).parent), "LANG": "C.UTF-8"}
NAME = re.compile(r"[a-z_][a-z0-9_-]{0,31}")
MAX_TOTAL, MAX_PER_USER = 3, 2
IDLE_LIMIT = 15 * 60

active = {}   # panel user -> number of open terminals


def clamp(n):
    return max(1, min(int(n), 500))


def set_size(fd, rows, cols):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


async def write_all(fd, data):
    view = memoryview(data)
    while len(view):
        try:
            n = os.write(fd, view)
            view = view[n:]
        except BlockingIOError:
            await asyncio.sleep(0.01)


def ssh_args(u):
    return [
        "-tt", "-e", "none", "-F", "/dev/null",
        "-o", "StrictHostKeyChecking=yes",
        "-o", f"UserKnownHostsFile={KNOWN_HOSTS}",
        "-o", "GlobalKnownHostsFile=/dev/null",
        "-o", "HostKeyAlgorithms=ssh-ed25519",
        "-o", "PubkeyAuthentication=no",
        "-o", "PreferredAuthentications=password,keyboard-interactive",
        "-o", "NumberOfPasswordPrompts=3",
        "-o", "ServerAliveInterval=30",
        "-o", "ClearAllForwardings=yes",
        "-o", "ForwardAgent=no", "-o", "ForwardX11=no",
        "-l", u, "127.0.0.1",
    ]


@router.websocket("/api/terminal/ws")
async def terminal(ws: WebSocket, u: str = "", cols: int = 80, rows: int = 24):
    user = ws_user(ws)
    if (user is None or not origin_ok(ws) or not NAME.fullmatch(u)
            or not KNOWN_HOSTS.exists()):
        await ws.close(code=1008)
        return
    if sum(active.values()) >= MAX_TOTAL or active.get(user, 0) >= MAX_PER_USER:
        await ws.close(code=1013)
        return
    await ws.accept()
    active[user] = active.get(user, 0) + 1

    started = last_input = time.time()
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()
    master = slave = -1
    reading = False
    proc = None
    tasks = []

    def on_readable():
        try:
            data = os.read(master, 65536)
        except BlockingIOError:
            return
        except OSError:               # EIO: the program closed the terminal
            data = b""
        queue.put_nowait(data)
        if not data or queue.qsize() > 64:
            stop_reading()

    def start_reading():
        nonlocal reading
        if not reading:
            loop.add_reader(master, on_readable)
            reading = True

    def stop_reading():
        nonlocal reading
        if reading:
            loop.remove_reader(master)
            reading = False

    async def pump_out():
        while True:
            data = await queue.get()
            if not data:
                return
            await ws.send_bytes(data)
            if queue.qsize() < 16:
                start_reading()

    async def pump_in():
        nonlocal last_input
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                return
            if msg.get("bytes") is not None:
                last_input = time.time()
                await write_all(master, msg["bytes"])
            elif msg.get("text") is not None:
                try:
                    c = json.loads(msg["text"])
                    if c.get("type") == "resize":
                        set_size(master, clamp(c["rows"]), clamp(c["cols"]))
                except (ValueError, KeyError, TypeError):
                    pass

    async def watchdog():
        while True:
            await asyncio.sleep(15)
            if ws_user(ws) is None:                      # logged out or expired
                return
            if time.time() - last_input > IDLE_LIMIT:    # nobody typing
                return

    try:
        master, slave = pty.openpty()
        os.set_blocking(master, False)
        set_size(master, clamp(rows), clamp(cols))
        proc = await asyncio.create_subprocess_exec(
            SETSID, "--ctty", SSH, *ssh_args(u),
            stdin=slave, stdout=slave, stderr=slave, env=ENV,
        )
        os.close(slave)
        slave = -1
        audit(user, ws.client.host, "terminal_open", target=u)
        start_reading()
        tasks = [asyncio.create_task(c()) for c in (pump_out, pump_in, watchdog)]
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        stop_reading()
        if proc is not None and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), 5)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
            except ProcessLookupError:
                pass
        for fd in (master, slave):
            if fd != -1:
                os.close(fd)
        active[user] -= 1
        if active[user] <= 0:
            del active[user]
        if proc is not None:
            audit(user, ws.client.host, "terminal_close", target=u,
                  seconds=int(time.time() - started))
        try:
            await ws.close()
        except Exception:
            pass
