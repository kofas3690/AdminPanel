import json, re, subprocess, time
from pathlib import Path
from typing import Literal
import psutil
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/network")

HELPER = "/usr/local/sbin/adminpanel-net"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
PROC = re.compile(r'\("([^"]+)",pid=(\d+)')
PROXY_RE = re.compile(r"(?P<scheme>https?|socks5h?)://(?P<host>[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
                      r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*|\[[0-9A-Fa-f:]+\])"
                      r"(?::(?P<port>\d{1,5}))?/?")


def run(cmd, stdin=None, timeout=60):
    kw = {"input": stdin} if stdin is not None else {"stdin": subprocess.DEVNULL}
    try:
        return subprocess.run(["/usr/bin/sudo", "-n", HELPER, cmd], capture_output=True,
                              text=True, timeout=timeout, env=ENV, **kw)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The network helper took too long to answer")


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or r.stdout).strip() or "Command failed")
    return r


def ipj(*args):
    try:
        r = subprocess.run(["ip", "-j", *args], capture_output=True, text=True,
                           timeout=10, env=ENV)
        return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else []
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return []


def kind_of(link):
    if link.get("link_type") == "loopback":
        return "loopback"
    k = (link.get("linkinfo") or {}).get("info_kind")
    if k:
        return k
    name = link.get("ifname", "")
    return "physical" if Path(f"/sys/class/net/{name}/device").exists() else "other"


def dns_info():
    servers, search = [], []
    try:
        for line in Path("/run/systemd/resolve/resolv.conf").read_text().splitlines():
            p = line.split()
            if len(p) > 1 and p[0] == "nameserver":
                servers.append(p[1])
            elif p and p[0] == "search":
                search = p[1:]
    except OSError:
        pass
    return {"servers": servers, "search": search}


@router.get("/overview")
def overview(user: str = Depends(current_user)):
    counters = psutil.net_io_counters(pernic=True)
    stats = psutil.net_if_stats()
    ifaces = []
    for l in ipj("-d", "addr", "show"):
        name = l.get("ifname")
        if not name:
            continue
        c, s = counters.get(name), stats.get(name)
        addrs = [{"addr": f'{a["local"]}/{a["prefixlen"]}', "family": a["family"],
                  "dynamic": bool(a.get("dynamic"))}
                 for a in l.get("addr_info", []) if a.get("family") in ("inet", "inet6")]
        ifaces.append({
            "name": name, "kind": kind_of(l), "state": str(l.get("operstate", "")).lower(),
            "mac": l.get("address", ""), "mtu": l.get("mtu"), "master": l.get("master", ""),
            "speed": s.speed if s else 0, "addresses": addrs,
            "rx_bytes": c.bytes_recv if c else 0, "tx_bytes": c.bytes_sent if c else 0,
            "errors": (c.errin + c.errout) if c else 0,
            "drops": (c.dropin + c.dropout) if c else 0,
        })
    routes = []
    for r in ipj("route", "show") + ipj("-6", "route", "show"):
        routes.append({"dst": r.get("dst", ""), "gateway": r.get("gateway", ""),
                       "dev": r.get("dev", ""), "metric": r.get("metric"),
                       "src": r.get("prefsrc", "")})
    return {"ts": time.time(), "interfaces": ifaces, "routes": routes, "dns": dns_info()}


@router.get("/connections")
def connections(user: str = Depends(current_user)):
    out = must(run("connections")).stdout
    rows = []
    for line in out.splitlines():
        p = line.split(None, 6)
        if len(p) < 6:
            continue
        procs = ", ".join(f"{n} ({pid})" for n, pid in PROC.findall(p[6])) if len(p) > 6 else ""
        rows.append({"proto": p[0], "state": p[1], "local": p[4], "peer": p[5], "process": procs})
        if len(rows) >= 1000:
            break
    return rows


@router.get("/config")
def config(user: str = Depends(current_user)):
    return json.loads(must(run("state")).stdout)


class ApplyBody(BaseModel):
    state: dict
    timeout: int = Field(default=90, ge=30, le=600)
    scope: Literal["network", "vpn"] = "network"


@router.post("/apply")
def apply(body: ApplyBody, request: Request, user: str = Depends(current_user)):
    payload = {"state": body.state, "timeout": body.timeout, "scope": body.scope,
               "admin_ip": request.client.host}
    r = run("apply", stdin=json.dumps(payload), timeout=100)
    items = body.state.get("items" if body.scope == "network" else "wireguard")
    names = sorted(items)[:64] if isinstance(items, dict) else []
    audit(user, request.client.host, "net_apply", scope=body.scope, items=names,
          timeout=body.timeout, ok=(r.returncode == 0))
    must(r)
    return json.loads(r.stdout)


@router.post("/confirm")
def confirm(request: Request, user: str = Depends(current_user)):
    r = run("confirm")
    audit(user, request.client.host, "net_confirm", ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


@router.post("/revert")
def revert(request: Request, user: str = Depends(current_user)):
    r = run("revert")
    audit(user, request.client.host, "net_revert", ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


# ---------------- WireGuard ----------------

@router.get("/wg/status")
def wg_status(user: str = Depends(current_user)):
    return json.loads(must(run("wg-status")).stdout)


class KeyBody(BaseModel):
    op: Literal["generate", "import-private", "import-psk"]
    name: str = Field(pattern=r"^[a-z][a-z0-9_.-]{0,14}$")
    value: str = Field(default="", max_length=128)


@router.post("/wg/key")
def wg_key(body: KeyBody, request: Request, user: str = Depends(current_user)):
    r = run("wg-key", stdin=json.dumps(body.model_dump()))
    # never log the key itself
    audit(user, request.client.host, "wg_key", op=body.op, name=body.name, ok=(r.returncode == 0))
    must(r)
    return json.loads(r.stdout)


# ---------------- proxy ----------------

class ProxyBody(BaseModel):
    enabled: bool
    http: str = Field(default="", max_length=300)
    https: str = Field(default="", max_length=300)
    no_proxy: list[str] = Field(default_factory=list, max_length=40)
    apt: bool = True
    environment: bool = True


@router.get("/proxy")
def proxy_get(user: str = Depends(current_user)):
    return json.loads(must(run("proxy-get")).stdout)


@router.post("/proxy")
def proxy_set(body: ProxyBody, request: Request, user: str = Depends(current_user)):
    r = run("proxy-set", stdin=json.dumps(body.model_dump()))
    audit(user, request.client.host, "proxy_set", enabled=body.enabled, http=body.http,
          https=body.https, apt=body.apt, environment=body.environment, ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


class ProxyTest(BaseModel):
    url: str = Field(max_length=300)


@router.post("/proxy/test")
def proxy_test(body: ProxyTest, user: str = Depends(current_user)):
    url = body.url.strip().rstrip("/")
    m = PROXY_RE.fullmatch(url)
    if not m or len(m["host"]) > 253 or (m["port"] and not 1 <= int(m["port"]) <= 65535):
        raise HTTPException(400, "A proxy address looks like http://host:3128 (no user name or password)")
    results = []
    for label, target in (("HTTP", "http://connectivity-check.ubuntu.com/"),
                          ("HTTPS", "https://archive.ubuntu.com/")):
        try:
            r = subprocess.run(["/usr/bin/curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
                                "--max-time", "10", "-x", url, target],
                               capture_output=True, text=True, timeout=20, env=ENV,
                               stdin=subprocess.DEVNULL)
            code = r.stdout.strip()
            good = r.returncode == 0 and code.isdigit() and 200 <= int(code) < 400
            results.append({"target": label, "ok": good, "code": code, "error": (r.stderr or "").strip()[:200]})
        except subprocess.TimeoutExpired:
            results.append({"target": label, "ok": False, "code": "", "error": "timed out"})
    return {"results": results}


# ---------------- peer config generator ----------------

from fastapi.responses import JSONResponse


class PeerBody(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_.-]{0,14}$")
    key_id: str = Field(pattern=r"^[0-9a-f]{8}$")
    address: str = Field(max_length=64)
    allowed: list[str] = Field(min_length=1, max_length=16)
    dns: list[str] = Field(default_factory=list, max_length=4)
    endpoint: str = Field(max_length=300)
    keepalive: int | None = Field(default=25, ge=0, le=65535)
    psk: bool = True


def qr_rows(text):
    try:
        import qrcode
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, border=0)
        qr.add_data(text)
        qr.make(fit=True)
        return ["".join("1" if c else "0" for c in row) for row in qr.get_matrix()]
    except Exception:
        return None


@router.post("/wg/peer")
def wg_peer(body: PeerBody, request: Request, user: str = Depends(current_user)):
    r = run("wg-peer", stdin=json.dumps(body.model_dump()))
    # never log the config: it contains the device's private key
    audit(user, request.client.host, "wg_peer_generated", name=body.name,
          address=body.address, ok=(r.returncode == 0))
    must(r)
    d = json.loads(r.stdout)
    d["qr"] = qr_rows(d["conf"])
    return JSONResponse(d, headers={"Cache-Control": "no-store"})
