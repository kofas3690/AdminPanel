# Remote servers: the bridge (work in progress)

From 1.0.5 the panel has the foundation for managing other machines, from 1.0.6 you can set a machine up with `adminpanel-setup`, and from 1.0.7 the **Remote services** page (in the sidebar) lets you pick a listed machine and start, stop or restart its allowed services. Other pages still work on this machine only.

## The idea (the same one Cockpit uses)

A small program, `bridge.py`, runs on the other machine over SSH. The central panel sends it one JSON request per line and reads one JSON answer per line. The bridge can only do the operations it lists, and it checks every argument again itself.

```
Central panel --SSH, pinned host key--> adminpanel-bridge (on the other machine)
                                          one JSON line in, one JSON line out
```

## Set up a machine (3 commands)

Install the adminpanel package (1.0.5 or later) on both machines. The other machine does not need to run the panel's web page; it only needs the package files and an SSH server.

1. **On the central panel**, create (or show) its key for other machines:

   ```bash
   sudo adminpanel-setup remote-key
   ```

   It prints the exact `remote-enable` command to run next, with the public key in it.

2. **On the other machine**, run that command:

   ```bash
   sudo adminpanel-setup remote-enable 'ssh-ed25519 AAAA... adminpanel-central'
   ```

   This creates the user `adminpanel-remote` (no password), allows that one key to run the bridge and nothing else, and installs the same sudo rules the panel itself uses, for that user. It prints the machine's SSH host key fingerprint.

3. **On the central panel**, list the machine:

   ```bash
   sudo adminpanel-setup add-host web1 192.168.1.20
   ```

   It reads the other machine's SSH host key, shows the fingerprint, and asks you to confirm that it matches the one from step 2. Then it pins the key, adds the machine to the list and tests the connection. Use `--fingerprint SHA256:...` instead of the question when there is no terminal.

Other commands: `adminpanel-setup list-hosts`, `adminpanel-setup remove-host NAME` (central panel) and `adminpanel-setup remote-disable` (other machine: removes the user, the key and the sudo rule).

## What is in the code

| File | What it does |
| --- | --- |
| `actions.py` | The checks and commands behind the Services page. Standard library only, so both the panel and the bridge use the same code. |
| `bridge.py` | Reads requests on standard input. Operations: `ping`, `services.list`, `services.act`. Unknown operations, extra arguments, bad JSON and lines over 64 KB are refused. It never runs anything that came from the request. |
| `remote.py` | The panel's side: one short SSH connection per request; the host key is checked against `/var/lib/adminpanel/remote_known_hosts` and the key is read from `/var/lib/adminpanel/remote_key`, both owned by root so the panel can read but not change them; the answer is limited to 1 MB. It also keeps the list of machines (at most 50). |
| `services.py` | Accepts `?host=<id>` on its two routes. Without it, it behaves exactly as before. |

## Try the bridge on one machine

```bash
echo '{"id":1,"op":"ping"}' | python3 /opt/adminpanel/bridge.py
echo '{"id":3,"op":"rm"}' | python3 /opt/adminpanel/bridge.py        # refused: unknown operation
```

## Safety rules

- The key in `authorized_keys` carries `command="/usr/bin/python3 /opt/adminpanel/bridge.py",restrict`. Asking the server for any other command just runs the bridge, and `restrict` turns off shells, port forwarding and agent forwarding for that key.
- `remote-enable` accepts only a plain `ssh-ed25519` public key line, so options or extra lines cannot be smuggled in.
- `add-host` pins the host key only after you confirm its fingerprint; a wrong fingerprint changes nothing. A changed host key later stops every request (502).
- A refused action never reaches `systemctl`, and the audit log records the host name with every remote action.
- The private key is root-owned and readable by the panel's group. Anyone who can take over the panel can use it to run the bridge's few operations on the listed machines, and nothing else; keep the list short and the panel's 2FA on.
