#!/usr/bin/python3
"""adminpanel-bridge: the small program a central panel runs on another machine over SSH.

It reads ONE request per line on standard input and writes ONE answer per line on standard output,
both JSON. It can do only what is listed in OPS below, every argument is checked again here, and it
never runs a command that came from the request. It is meant to be the forced command of a
restricted SSH key (see docs/REMOTE.md), so the key can do nothing else.

    {"id": 1, "op": "ping"}                                     -> {"id": 1, "ok": true, "result": {...}}
    {"id": 2, "op": "services.act", "args": {"name": "nginx", "action": "restart"}}
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import actions                                           # noqa: E402

MAX_LINE = 65536


def version():
    try:
        return (Path(__file__).resolve().parent / "VERSION").read_text().strip()[:40] or "unknown"
    except OSError:
        return "unknown"


def op_ping(args):
    return {"app": "adminpanel-bridge", "version": version()}


def op_services_list(args):
    return actions.list_services()


def op_services_act(args):
    actions.act_service(args.get("name"), args.get("action"))
    return True


def op_system_info(args):
    return actions.system_info()


def op_logs_tail(args):
    return actions.service_logs(args.get("name"), args.get("lines", 100))


OPS = {                                  # operation -> (function, the argument names it accepts)
    "ping": (op_ping, ()),
    "services.list": (op_services_list, ()),
    "services.act": (op_services_act, ("name", "action")),
    "system.info": (op_system_info, ()),
    "logs.tail": (op_logs_tail, ("name", "lines")),
}


def handle(line):
    """One request line in, one answer (a dict) out. Never raises."""
    rid = None
    try:
        if len(line) > MAX_LINE:
            return {"id": None, "ok": False, "status": 413, "error": "request too large"}
        req = json.loads(line)
        if not isinstance(req, dict):
            raise ValueError("not an object")
        rid = req.get("id")
        if not isinstance(rid, (int, str)) or isinstance(rid, bool):
            rid = None
        entry = OPS.get(req.get("op")) if isinstance(req.get("op"), str) else None
        if entry is None:
            return {"id": rid, "ok": False, "status": 404, "error": "unknown operation"}
        func, allowed = entry
        args = req.get("args", {})
        if not isinstance(args, dict) or set(args) - set(allowed):
            return {"id": rid, "ok": False, "status": 400, "error": "bad arguments"}
        return {"id": rid, "ok": True, "result": func(args)}
    except actions.ActionError as e:
        return {"id": rid, "ok": False, "status": e.status, "error": e.message}
    except ValueError:
        return {"id": rid, "ok": False, "status": 400, "error": "bad request"}
    except Exception:                                    # never leak a traceback to the other side
        return {"id": rid, "ok": False, "status": 500, "error": "internal error"}


def main():
    for raw in sys.stdin:
        sys.stdout.write(json.dumps(handle(raw), separators=(",", ":")) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
