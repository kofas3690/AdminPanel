import ipaddress, re, subprocess
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/firewall")

HELPER = "/usr/local/sbin/adminpanel-ufw"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}

R_SIMPLE = re.compile(r"^ufw allow (\d{1,5})(?:/(tcp|udp))?$")
R_SRC = re.compile(r"^ufw allow from (\S+) to any port (\d{1,5})(?: proto (tcp|udp))?$")


class Rule(BaseModel):
    port: int = Field(ge=1, le=65535)
    proto: Literal["tcp", "udp"]
    source: Optional[str] = None

    @field_validator("source")
    @classmethod
    def check_source(cls, v):
        if v is None or not v.strip():
            return None
        try:
            return str(ipaddress.ip_network(v.strip(), strict=False))
        except ValueError:
            raise ValueError("source must be an IP address or a CIDR network")


def run(*args):
    return subprocess.run(["/usr/bin/sudo", "-n", HELPER, *args],
                          capture_output=True, text=True, timeout=60, env=ENV)


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or r.stdout).strip() or "Command failed")
    return r


def rule_cmd(rule):
    return [str(rule.port), rule.proto] + ([rule.source] if rule.source else [])


@router.get("")
def overview(user: str = Depends(current_user)):
    status = must(run("status")).stdout
    m = re.search(r"^Status:\s*(\w+)", status, re.M)
    active = bool(m) and m[1] == "active"

    rules = []
    for line in must(run("added")).stdout.splitlines():
        line = line.strip()
        if not line.startswith("ufw "):
            continue
        item = {"raw": line, "port": None, "proto": None, "source": None}
        m1, m2 = R_SIMPLE.match(line), R_SRC.match(line)
        if m1:
            item["port"], item["proto"] = int(m1[1]), m1[2]
        elif m2:
            item["source"], item["port"], item["proto"] = m2[1], int(m2[2]), m2[3]
        item["manageable"] = item["proto"] is not None
        item["protected"] = item["port"] == 22
        rules.append(item)
    return {"active": active, "rules": rules, "status_text": status}


@router.post("/allow")
def allow(rule: Rule, request: Request, user: str = Depends(current_user)):
    r = run("allow", *rule_cmd(rule))
    audit(user, request.client.host, "firewall_allow", port=rule.port,
          proto=rule.proto, source=rule.source, ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


@router.post("/delete")
def delete(rule: Rule, request: Request, user: str = Depends(current_user)):
    r = run("delete", *rule_cmd(rule))
    audit(user, request.client.host, "firewall_delete", port=rule.port,
          proto=rule.proto, source=rule.source, ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


@router.post("/enable")
def enable(request: Request, user: str = Depends(current_user)):
    r = run("enable")
    audit(user, request.client.host, "firewall_enable", ok=(r.returncode == 0))
    must(r)
    return {"ok": True}
