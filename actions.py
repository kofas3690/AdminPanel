"""Actions that change or read this machine, written so that both the panel and `bridge.py` can call them.

Standard library only. Nothing here knows about web requests or about SSH; it takes plain values,
checks them, and either returns a result or raises ActionError(status, message).
"""
import os, shutil, subprocess

SYSTEMCTL = "/usr/bin/systemctl"
JOURNALCTL = "/usr/bin/journalctl"
MAX_LOG_LINES = 500
MAX_LOG_BYTES = 200 * 1024

ALLOWED = {
    "nginx": ["start", "stop", "restart", "enable", "disable"],
    "cron": ["start", "stop", "restart", "enable", "disable"],
    "ssh": ["restart"],          # never enable/disable: a mistake here could lock you out of the machine
}
# "enable" / "disable" only change whether the service starts at boot. They never start or stop it now.
BOOT_ACTIONS = ("enable", "disable")


# Reboot and shut down. Only these two, with these exact arguments (the sudo rule names them too).
POWER_ACTIONS = {"reboot": "reboot", "poweroff": "poweroff"}
BUSY = {"apt", "apt-get", "dpkg", "unattended-upgr"}      # process names that mean a software update is running
# Ubuntu keeps "unattended-upgrade-shutdown" running all the time, waiting for a shutdown signal. It has the
# same short process name as a real unattended upgrade but is not an update, so it is told apart by its command line.
IDLE_DAEMON = "unattended-upgrade-shutdown"


class ActionError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def _run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=30)


def list_services():
    result = []
    for name, actions in ALLOWED.items():
        r = _run([SYSTEMCTL, "show", f"{name}.service",
                  "--property=LoadState,ActiveState,SubState,Description,UnitFileState"])
        props = dict(l.split("=", 1) for l in r.stdout.splitlines() if "=" in l)
        if props.get("LoadState") == "not-found":
            result.append({"name": name, "state": "not installed", "description": "", "actions": []})
        else:
            boot = props.get("UnitFileState", "")
            has_boot_buttons = any(a in BOOT_ACTIONS for a in actions)
            if boot not in ("enabled", "disabled"):       # static, masked, alias... : leave the boot state alone
                boot = boot or "unknown"
                shown = [a for a in actions if a not in BOOT_ACTIONS]
            else:                                          # offer only the button that changes something
                shown = [a for a in actions if a != ("enable" if boot == "enabled" else "disable")]
            result.append({
                "name": name,
                "state": f'{props.get("ActiveState")}/{props.get("SubState")}',
                "description": props.get("Description", ""),
                # Not shown for ssh: on Ubuntu 24.04 it starts through ssh.socket, so the service itself
                # reads "disabled" even though SSH comes up at boot. That would only worry people.
                "boot": boot if has_boot_buttons else "",
                "actions": shown,
            })
    return result


def act_service(name, action):
    """Starts, stops, restarts, enables or disables (at boot) one of the allowed services. Returns True, or raises ActionError."""
    if not isinstance(name, str) or not isinstance(action, str) or action not in ALLOWED.get(name, []):
        raise ActionError(403, "Not allowed")
    r = _run(["sudo", "-n", SYSTEMCTL, action, name])
    if r.returncode != 0:
        err = r.stderr.strip()
        if action in BOOT_ACTIONS and "password is required" in err:
            # An older sudo rule (copied before 1.2.0) does not know enable/disable yet.
            raise ActionError(500, "This machine's sudo rule is older. Run 'sudo adminpanel-setup remote-enable' there again")
        raise ActionError(500, err or "Command failed")
    return True


def update_running():
    """The name of the update process running (apt, apt-get, dpkg, unattended-upgr), or "" when none is.
    Stopping an update half way can break packages."""
    try:
        pids = [p for p in os.listdir("/proc") if p.isdigit()]
    except OSError:
        return ""
    for pid in pids:
        try:
            with open(f"/proc/{pid}/comm") as f:
                name = f.read().strip()
            if name not in BUSY:
                continue
            if name == "unattended-upgr":
                with open(f"/proc/{pid}/cmdline", "rb") as f:
                    if IDLE_DAEMON in f.read().decode("utf-8", "replace"):
                        continue
            return name
        except OSError:
            continue
    return ""


def check_power(action):
    """Raises ActionError unless a reboot or shut down may start now. Starts nothing."""
    if not isinstance(action, str) or action not in POWER_ACTIONS:
        raise ActionError(403, "Not allowed")
    busy = update_running()
    if busy:
        raise ActionError(409, f"A software update is running there ({busy}). Wait until it has finished.")
    r = _run(["sudo", "-n", "-l", SYSTEMCTL, "--no-block", POWER_ACTIONS[action]])
    if r.returncode != 0:
        # Checked before answering, because the real command only runs after the answer has been sent.
        raise ActionError(500, "This machine's sudo rule is older. Run 'sudo adminpanel-setup remote-enable' there again")


def run_power(action):
    """Asks systemd to start the reboot or shut down. --no-block returns as soon as the job is queued."""
    if not isinstance(action, str) or action not in POWER_ACTIONS:
        raise ActionError(403, "Not allowed")
    r = _run(["sudo", "-n", SYSTEMCTL, "--no-block", POWER_ACTIONS[action]])
    if r.returncode != 0:
        raise ActionError(500, (r.stderr or "").strip()[:200] or "Command failed")
    return True


def _meminfo():
    out = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, _, v = line.partition(":")
            if k in ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree"):
                out[k] = int(v.split()[0]) * 1024
    return out


def system_info():
    """Read-only facts about this machine, for the Remote services page."""
    osname = ""
    try:
        for line in open("/etc/os-release"):
            if line.startswith("PRETTY_NAME="):
                osname = line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    try:
        uptime = int(float(open("/proc/uptime").read().split()[0]))
    except (OSError, ValueError, IndexError):
        uptime = None
    try:
        m = _meminfo()
    except (OSError, ValueError):
        m = {}
    d = shutil.disk_usage("/")
    u = os.uname()
    return {"hostname": u.nodename[:100], "os": osname[:100], "kernel": u.release[:100], "uptime": uptime,
            "load": [round(x, 2) for x in os.getloadavg()], "cpus": os.cpu_count(),
            "mem_total": m.get("MemTotal"), "mem_available": m.get("MemAvailable"),
            "disk_total": d.total, "disk_used": d.used}


def service_logs(name, lines):
    """The last lines of the journal of one allowed service."""
    if not isinstance(name, str) or name not in ALLOWED:
        raise ActionError(403, "Not allowed")
    if not isinstance(lines, int) or isinstance(lines, bool) or not 1 <= lines <= MAX_LOG_LINES:
        raise ActionError(400, f"lines must be a number from 1 to {MAX_LOG_LINES}")
    r = _run([JOURNALCTL, "-u", f"{name}.service", "-n", str(lines), "--no-pager", "-o", "short-iso", "-q"])
    if r.returncode != 0:
        raise ActionError(500, "Could not read the journal on that machine")
    text = r.stdout
    if len(text.encode("utf-8", "replace")) > MAX_LOG_BYTES:
        text = text.encode("utf-8", "replace")[-MAX_LOG_BYTES:].decode("utf-8", "replace")
    return text
