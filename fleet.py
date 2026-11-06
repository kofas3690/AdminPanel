"""Servers page: a list of other AdminPanel servers with their status and a link to each.

Nothing is shared with the other servers and nothing is proxied: every server keeps its own
administrators, 2FA and audit log. This page only asks each one "are you there, and which version
are you?" (GET /api/health, which needs no login and tells nothing else), and pins the other
server's TLS certificate so a changed or swapped certificate is noticed.
"""
import hashlib, ipaddress, json, socket, ssl, threading, time, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from audit import audit
from auth import current_user
from store import PersistentDict

router = APIRouter(prefix="/api/fleet")
health_router = APIRouter()

hosts = PersistentDict("fleet_hosts")        # id -> {name, url, fp, by, added}
MAX_HOSTS = 50
TIMEOUT = 4                                  # seconds to connect, and to read the answer
MAX_ANSWER = 4096                            # bytes read from another server
CACHE_FOR = 15                               # seconds a status stays fresh
_cache = {}                                  # id -> (time, result)
_cache_lock = threading.Lock()
_pool = ThreadPoolExecutor(max_workers=8)


def own_version():
    try:
        return (Path(__file__).parent / "VERSION").read_text().strip()[:40] or "unknown"
    except OSError:
        return "unknown"


@health_router.get("/api/health")
def health():
    """Used by other AdminPanel servers. Answers with the version only, and needs no login."""
    return {"app": "adminpanel", "version": own_version()}


# ------------------------------------------------------------------ talking to another server
class BadUrl(ValueError):
    pass


def parse_url(text):
    """Returns (host, port, origin). Only https, no user name, no path, no link-local addresses."""
    try:
        u = urlsplit(text.strip())
        port = u.port or 443
    except ValueError:
        raise BadUrl("That is not a valid address")
    if u.scheme != "https":
        raise BadUrl("The address must start with https://")
    if not u.hostname or u.username or u.password or u.query or u.fragment or u.path not in ("", "/"):
        raise BadUrl("Use only the address, for example https://192.168.1.20:8443/")
    host = u.hostname.lower()
    if len(host) > 253 or any(c in host for c in " \t\r\n\\'\""):
        raise BadUrl("That is not a valid address")
    shown = f"[{host}]" if ":" in host else host
    origin = f"https://{shown}" + (f":{port}" if port != 443 else "") + "/"
    return host, port, origin


def pick_address(host, port):
    """Resolves the name once, and refuses addresses that can never be an AdminPanel server."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError:
        raise OSError("the name could not be resolved")
    for fam, _t, _p, _c, sa in infos:
        ip = ipaddress.ip_address(sa[0].split("%")[0])
        if ip.is_link_local or ip.is_unspecified or ip.is_multicast:
            raise OSError("that address is not allowed")
        return fam, sa
    raise OSError("the name could not be resolved")


def ask(url, pin=None):
    """Connects to another server and returns {status, fp, version, ms, error}.

    status: up | down | cert_changed | not_adminpanel. The connection is made to the address chosen
    above, the certificate is read (not trusted blindly: it is compared with the pin), and one plain
    GET /api/health is sent. Redirects are never followed and the answer is capped.
    """
    t0 = time.time()
    host, port, _ = parse_url(url)
    sock = tls = None
    try:
        fam, sa = pick_address(host, port)
        sock = socket.socket(fam, socket.SOCK_STREAM)
        sock.settimeout(TIMEOUT)
        sock.connect(sa)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE          # identity comes from the pinned fingerprint instead
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        tls = ctx.wrap_socket(sock, server_hostname=None if ":" in host or host.replace(".", "").isdigit() else host)
        fp = hashlib.sha256(tls.getpeercert(binary_form=True)).hexdigest()
        if pin and fp != pin:
            return {"status": "cert_changed", "fp": fp, "ms": int((time.time() - t0) * 1000)}
        shown = f"[{host}]" if ":" in host else host
        tls.sendall((f"GET /api/health HTTP/1.1\r\nHost: {shown}:{port}\r\nUser-Agent: adminpanel-fleet\r\n"
                     "Accept: application/json\r\nConnection: close\r\n\r\n").encode())
        data = b""
        while len(data) < MAX_ANSWER:
            chunk = tls.recv(MAX_ANSWER - len(data))
            if not chunk:
                break
            data += chunk
        head, _, body = data.partition(b"\r\n\r\n")
        if not head.startswith(b"HTTP/1.1 200") and not head.startswith(b"HTTP/1.0 200"):
            return {"status": "not_adminpanel", "fp": fp, "ms": int((time.time() - t0) * 1000)}
        try:
            j = json.loads(body.decode("utf-8", "replace"))
        except ValueError:
            j = None
        if not isinstance(j, dict) or j.get("app") != "adminpanel" or not isinstance(j.get("version"), str):
            return {"status": "not_adminpanel", "fp": fp, "ms": int((time.time() - t0) * 1000)}
        return {"status": "up", "fp": fp, "version": j["version"][:40], "ms": int((time.time() - t0) * 1000)}
    except (OSError, ssl.SSLError) as e:
        return {"status": "down", "error": short_error(e), "ms": int((time.time() - t0) * 1000)}
    finally:
        for s in (tls, sock):
            try:
                if s:
                    s.close()
            except OSError:
                pass


def short_error(e):
    if isinstance(e, socket.timeout) or "timed out" in str(e):
        return "no answer (timed out)"
    if isinstance(e, ConnectionRefusedError):
        return "connection refused"
    if isinstance(e, ssl.SSLError):
        return "not a TLS server"
    msg = str(e)
    return (msg.split("] ")[-1] if msg else type(e).__name__)[:80]


def status_of(hid, rec, fresh=False):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(hid)
        if hit and not fresh and now - hit[0] < CACHE_FOR and hit[2] == rec["fp"]:
            return hit[1]
    result = ask(rec["url"], rec["fp"])
    result["checked"] = int(now)
    with _cache_lock:
        _cache[hid] = (now, result, rec["fp"])
    return result


# ------------------------------------------------------------------ the page's API
class AddBody(BaseModel):
    name: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$")
    url: str = Field(min_length=8, max_length=200)
    fp: str = Field(pattern=r"^[0-9a-f]{64}$")


class ProbeBody(BaseModel):
    url: str = Field(min_length=8, max_length=200)


class PinBody(BaseModel):
    fp: str = Field(pattern=r"^[0-9a-f]{64}$")


def row(hid, rec, st):
    return {"id": hid, "name": rec["name"], "url": rec["url"], "fp": rec["fp"],
            "added": rec.get("added"), **st}


@router.get("/hosts")
def list_hosts(user: str = Depends(current_user)):
    recs = sorted(hosts.items(), key=lambda kv: kv[1]["name"].lower())
    futures = [(hid, rec, _pool.submit(status_of, hid, rec)) for hid, rec in recs]
    out = [row(hid, rec, f.result()) for hid, rec, f in futures]
    return {"self": {"name": socket.gethostname(), "version": own_version()}, "hosts": out}


@router.post("/probe")
def probe(body: ProbeBody, user: str = Depends(current_user)):
    """First step of adding a server: look at it and show its certificate fingerprint."""
    try:
        parse_url(body.url)
    except BadUrl as e:
        raise HTTPException(400, str(e))
    st = ask(body.url)
    if st["status"] == "down":
        raise HTTPException(502, f"Could not reach that server: {st.get('error', 'no answer')}")
    if st["status"] != "up":
        raise HTTPException(422, "That address answered, but it is not an AdminPanel server")
    return {"fp": st["fp"], "version": st["version"]}


@router.post("/hosts")
def add_host(body: AddBody, request: Request, user: str = Depends(current_user)):
    try:
        _, _, origin = parse_url(body.url)
    except BadUrl as e:
        raise HTTPException(400, str(e))
    if len(hosts.items()) >= MAX_HOSTS:
        raise HTTPException(409, f"At most {MAX_HOSTS} servers can be listed")
    for _hid, rec in hosts.items():
        if rec["url"] == origin:
            raise HTTPException(409, "That server is already in the list")
        if rec["name"].lower() == body.name.lower():
            raise HTTPException(409, "A server with that name is already in the list")
    st = ask(origin)
    if st["status"] == "down":
        raise HTTPException(502, f"Could not reach that server: {st.get('error', 'no answer')}")
    if st["status"] != "up":
        raise HTTPException(422, "That address answered, but it is not an AdminPanel server")
    if st["fp"] != body.fp:
        raise HTTPException(409, "The certificate is not the one you confirmed. Look at the server again")
    hid = uuid.uuid4().hex[:8]
    hosts[hid] = {"name": body.name, "url": origin, "fp": body.fp, "by": user, "added": int(time.time())}
    audit(user, request.client.host, "fleet_host_added", host=body.name, url=origin, fp=body.fp)
    return {"id": hid}


@router.post("/hosts/{hid}/pin")
def repin(hid: str, body: PinBody, request: Request, user: str = Depends(current_user)):
    """Accepts a new certificate for a listed server (after its certificate was renewed on purpose)."""
    if len(hid) != 8 or any(c not in "0123456789abcdef" for c in hid):
        raise HTTPException(404, "Unknown server")
    rec = hosts.get(hid)
    if rec is None:
        raise HTTPException(404, "Unknown server")
    st = ask(rec["url"])
    if st["status"] not in ("up", "cert_changed") or st.get("fp") != body.fp:
        raise HTTPException(409, "The certificate is not the one you confirmed. Look at the server again")
    old = rec["fp"]
    rec["fp"] = body.fp
    hosts[hid] = rec
    with _cache_lock:
        _cache.pop(hid, None)
    audit(user, request.client.host, "fleet_host_repinned", host=rec["name"], old_fp=old, fp=body.fp)
    return {"ok": True}


@router.delete("/hosts/{hid}")
def remove_host(hid: str, request: Request, user: str = Depends(current_user)):
    if len(hid) != 8 or any(c not in "0123456789abcdef" for c in hid):
        raise HTTPException(404, "Unknown server")
    rec = hosts.get(hid)
    if rec is None:
        raise HTTPException(404, "Unknown server")
    hosts.pop(hid, None)
    with _cache_lock:
        _cache.pop(hid, None)
    audit(user, request.client.host, "fleet_host_removed", host=rec["name"], url=rec["url"])
    return {"ok": True}
