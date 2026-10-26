import asyncio, time
from urllib.parse import urlparse
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from auth import sessions
from services import ALLOWED
from audit import audit

router = APIRouter()
JOURNALCTL = "/usr/bin/journalctl"


def ws_user(ws: WebSocket):
    token = ws.cookies.get("session")
    rec = sessions.get(token) if token else None
    if not rec or rec[1] < time.time():
        return None
    return rec[0]


def origin_ok(ws: WebSocket):
    origin = ws.headers.get("origin")
    return origin is not None and urlparse(origin).netloc == ws.headers.get("host")


@router.websocket("/api/logs/{name}")
async def stream_logs(ws: WebSocket, name: str):
    user = ws_user(ws)
    if user is None or name not in ALLOWED or not origin_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()

    proc = await asyncio.create_subprocess_exec(
        JOURNALCTL, "-u", f"{name}.service",
        "-n", "100", "-f", "--no-pager", "-o", "short-iso",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        limit=2**20,
    )
    audit(user, ws.client.host, "log_stream", service=name)

    async def pump():
        while True:
            line = await proc.stdout.readline()
            if not line:
                return
            await ws.send_text(line.decode(errors="replace").rstrip())

    async def watch():
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            return

    tasks = [asyncio.create_task(pump()), asyncio.create_task(watch())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if proc.returncode is None:
            proc.kill()
        await proc.wait()
