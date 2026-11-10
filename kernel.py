"""Kernel: loaded modules, whether the kernel is tainted, and a short list of security-relevant settings.

Everything is read from /proc as the panel's own account; nothing is changed. The settings table compares each
value with what is commonly recommended for a server and says so in words. Where the right value depends on the
machine's job (IP forwarding on a router, for example) the row is marked as informational rather than wrong.
"""
import os
from pathlib import Path
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api/kernel")

PROC_MODULES = Path("/proc/modules")
SYSCTL = Path("/proc/sys")
MAX_MODULES = 1500

TAINT = {0: "A module with a proprietary licence is loaded", 1: "A module was force-loaded", 2: "Unsafe SMP processors",
         3: "A module was force-unloaded", 4: "A machine check exception happened", 5: "A bad memory page was seen",
         6: "Tainted by a user request", 7: "The kernel died (an oops)", 8: "The ACPI table was overridden",
         9: "The kernel printed a warning", 10: "A staging driver is loaded", 11: "A firmware workaround was applied",
         12: "An out-of-tree module is loaded", 13: "An unsigned module is loaded", 14: "A soft lockup happened",
         15: "The kernel was live-patched"}

# key, what it does, recommended values (None = informational), advice shown when different
SETTINGS = [
    ("kernel.randomize_va_space", "Randomises memory layout so attacks are harder", {"2"}, "Set to 2 (full randomisation)."),
    ("kernel.kptr_restrict", "Hides kernel addresses from ordinary users", {"1", "2"}, "Set to 1 or 2."),
    ("kernel.dmesg_restrict", "Only root may read the kernel log", {"1"}, "Set to 1."),
    ("kernel.yama.ptrace_scope", "Limits which processes may inspect others", {"1", "2", "3"}, "Set to 1 or higher."),
    ("kernel.unprivileged_bpf_disabled", "Stops ordinary users loading BPF programs", {"1", "2"}, "Set to 1 or 2."),
    ("fs.protected_symlinks", "Blocks symlink tricks in shared directories like /tmp", {"1"}, "Set to 1."),
    ("fs.protected_hardlinks", "Blocks hard-link tricks in shared directories", {"1"}, "Set to 1."),
    ("fs.suid_dumpable", "Whether set-uid programs may write core dumps", {"0"}, "Set to 0."),
    ("net.ipv4.tcp_syncookies", "Helps survive SYN flood attacks", {"1"}, "Set to 1."),
    ("net.ipv4.conf.all.rp_filter", "Drops packets with forged source addresses", {"1", "2"}, "Set to 1 or 2."),
    ("net.ipv4.conf.all.accept_redirects", "Whether to obey routers telling it to use another route", {"0"}, "Set to 0."),
    ("net.ipv4.conf.all.send_redirects", "Whether to tell other machines to use another route", {"0"}, "Set to 0 unless this machine is a router."),
    ("net.ipv4.icmp_echo_ignore_broadcasts", "Ignores broadcast pings (used in amplification attacks)", {"1"}, "Set to 1."),
    ("net.ipv4.ip_forward", "Whether this machine passes traffic between networks (router mode)", None, ""),
    ("net.ipv6.conf.all.accept_ra", "Whether to accept IPv6 router advertisements", None, ""),
    ("vm.swappiness", "How eagerly memory is moved to swap", None, ""),
]


def read_value(key):
    try:
        v = (SYSCTL / key.replace(".", "/")).read_text(errors="replace").strip()
    except OSError:
        return None
    return " ".join(v.split())[:200]


def settings():
    out = []
    for key, what, good, advice in SETTINGS:
        v = read_value(key)
        if v is None:
            st = "unavailable"
        elif good is None:
            st = "info"
        else:
            st = "ok" if v in good else "different"
        out.append({"key": key, "what": what, "value": v, "status": st, "advice": advice if st == "different" else ""})
    return out


def taint():
    v = read_value("kernel.tainted")
    try:
        n = int(v)
    except (TypeError, ValueError):
        return {"value": None, "reasons": []}
    return {"value": n, "reasons": [TAINT.get(b, "Unknown reason (bit %d)" % b) for b in range(32) if n >> b & 1]}


def modules():
    out = []
    try:
        lines = PROC_MODULES.read_text(errors="replace").splitlines()
    except OSError:
        return None
    for line in lines[:MAX_MODULES]:
        p = line.split()
        if len(p) < 4 or not p[1].isdigit() or not p[2].isdigit():
            continue
        used = [] if p[3] == "-" else [x for x in p[3].split(",") if x]
        out.append({"name": p[0][:64], "size": int(p[1]), "refs": int(p[2]), "used_by": used[:20]})
    return out


@router.get("")
def overview(user: str = Depends(current_user)):
    m = modules()
    return {"release": os.uname().release, "version": os.uname().version[:120], "machine": os.uname().machine,
            "taint": taint(), "settings": settings(), "modules": m or [], "modules_available": m is not None}
