# Remote servers: the bridge (work in progress)

Release 1.0.5 adds the foundation for managing other machines from one panel. Nothing visible changes yet: there is no host selector in the pages and no command to add a server. Those come in the next releases. This page describes what exists now, so it can be checked.

## The idea (the same one Cockpit uses)

A small program, `bridge.py`, runs on the other machine over SSH. The central panel sends it one JSON request per line and reads one JSON answer per line. The bridge can only do the operations it lists, and it checks every argument again itself.

```
Central panel --SSH, pinned host key--> adminpanel-bridge (on the other machine)
                                          one JSON line in, one JSON line out
```

## What is in 1.0.5

| File | What it does |
| --- | --- |
| `actions.py` | The checks and commands behind the Services page (the allowed services, `systemctl show`, `sudo -n systemctl start/stop/restart`). Standard library only, so both the panel and the bridge use the same code. |
| `bridge.py` | Reads requests on standard input. Operations: `ping`, `services.list`, `services.act`. Unknown operations, extra arguments, bad JSON and lines over 64 KB are refused. It never runs anything that came from the request. |
| `remote.py` | The panel's side: one short SSH connection per request, host key checked against the root-owned file `/var/lib/adminpanel/remote_known_hosts`, answer limited to 1 MB, plain error messages. |
| `services.py` | Now accepts `?host=<id>` on its two routes. Without it (or with `host=local`) it behaves exactly as before. |

## Try the bridge on one machine

```bash
echo '{"id":1,"op":"ping"}' | python3 /opt/adminpanel/bridge.py
echo '{"id":2,"op":"services.list"}' | python3 /opt/adminpanel/bridge.py
echo '{"id":3,"op":"rm"}' | python3 /opt/adminpanel/bridge.py        # refused: unknown operation
```

## How a remote machine will be prepared (planned, done by hand for now)

1. A user `adminpanel-remote` with no password.
2. One line in its `~/.ssh/authorized_keys`, so that the key can run the bridge and nothing else:

   ```
   command="/usr/bin/python3 /opt/adminpanel/bridge.py",restrict ssh-ed25519 AAAA... adminpanel-central
   ```

3. A sudo rule that allows only the same `systemctl` commands the panel already uses.
4. The machine's SSH host key pinned in `/var/lib/adminpanel/remote_known_hosts` on the central panel (root-owned, so the panel cannot change it).

The next release adds `adminpanel-setup` commands that do these steps and show the fingerprints for you to confirm.

## Safety rules already in place

- With the forced command, asking the server for any other command just runs the bridge, and `restrict` turns off shells, port forwarding and agent forwarding for that key.
- A refused action never reaches `systemctl`; the audit log records the host name with every remote action.
- A changed host key stops the request (502). Remote host ids must be 8 hexadecimal characters.
