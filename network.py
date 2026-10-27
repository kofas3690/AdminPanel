import json, re, subprocess, time
from pathlib import Path
import psutil
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/network")

HELPER = "/usr/local/sbin/adminpanel-net"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
PROC = re.compile(r'\("([^"]+)",pid=(\d+)')


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


@router.post("/apply")
def apply(body: ApplyBody, request: Request, user: str = Depends(current_user)):
    items = body.state.get("items")
    names = sorted(items)[:64] if isinstance(items, dict) else []
    r = run("apply", stdin=json.dumps({"state": body.state, "timeout": body.timeout}), timeout=90)
    audit(user, request.client.host, "net_apply", items=names,
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
