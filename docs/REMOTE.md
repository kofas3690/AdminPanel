# Remote servers: the bridge (work in progress)

From 1.0.5 the panel has the foundation for managing other machines, from 1.0.6 you can set a machine up with `adminpanel-setup`, from 1.0.7 the **Remote services** page (in the sidebar) lets you pick a listed machine and start, stop or restart its allowed services, and from 1.0.8 that page also shows the machine's basic facts and the recent log of each service. Other pages still work on this machine only.

## The idea (the same one Cockpit uses)

A small program, `bridge.py`, runs on the other machine over SSH. The central panel sends it one JSON request per line and reads one JSON answer per line. The bridge can only do the operations it lists, and it checks every argument again itself.

```
Central panel --SSH, pinned host key--> adminpanel-bridge (on the other machine)
                                          one JSON line in, one JSON line out
```

## Set up a machine (3 commands)

Install the adminpanel package (1.1.0 or later; older versions could not run the bridge for the remote account, see below) on both machines. The other machine does not need to run the panel's web page; it only needs the package files and an SSH server.

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
| `bridge.py` | Reads requests on standard input. Operations: `ping`, `services.list`, `services.act`, `system.info` (hostname, system, kernel, uptime, load, memory, disk) and `logs.tail` (the last 1 to 500 journal lines of one allowed service only). Unknown operations, extra arguments, bad JSON and lines over 64 KB are refused. It never runs anything that came from the request. |
| `remote.py` | The panel's side: one short SSH connection per request; the host key is checked against `/var/lib/adminpanel/remote_known_hosts` and the key is read from `/var/lib/adminpanel/remote_key`, both owned by root so the panel can read but not change them; the answer is limited to 1 MB. It also keeps the list of machines (at most 50). |
| `services.py` | Accepts `?host=<id>` on its two routes. Without it, it behaves exactly as before. |

## Try the bridge on one machine

```bash
echo '{"id":1,"op":"ping"}' | python3 /usr/lib/adminpanel-bridge/bridge.py
echo '{"id":3,"op":"rm"}' | python3 /usr/lib/adminpanel-bridge/bridge.py        # refused: unknown operation
```

## Where the bridge lives (1.1.0)

The bridge is installed in its own root-owned folder, `/usr/lib/adminpanel-bridge/`, and `remote-enable` points the key at it. Before 1.1.0 the key pointed into `/opt/adminpanel`, which is private to the panel's own account, so the bridge could not start and the panel said "No usable answer from that server". The new place has a second benefit: the panel's account cannot change the code that the bridge runs.

**On every machine you set up before 1.1.0:** install the 1.1.0 package, then run the same `sudo adminpanel-setup remote-enable '...'` command again. It rewrites the key's command and removes the group workaround (`usermod -aG adminpanel adminpanel-remote`) if you used it.

## Reading logs (1.0.8)

`remote-enable` now also adds the `adminpanel-remote` user to the `systemd-journal` group, the same as the panel's own account, so the bridge can read the journal. This lets the user read the whole journal of that machine, but the bridge only returns the log of the three allowed services (nginx, cron, ssh), at most 500 lines (200 KB). **A machine you already set up needs `sudo adminpanel-setup remote-enable '...'` run once more** (the same command; it is safe to repeat) to get the group. Until then the log button shows "Could not read the journal on that machine". Reading a log is written to the audit log as `remote_logs_read`.

## Safety rules

- The key in `authorized_keys` carries `command="/usr/bin/python3 /usr/lib/adminpanel-bridge/bridge.py",restrict`. Asking the server for any other command just runs the bridge, and `restrict` turns off shells, port forwarding and agent forwarding for that key.
- `remote-enable` accepts only a plain `ssh-ed25519` public key line, so options or extra lines cannot be smuggled in.
- `add-host` pins the host key only after you confirm its fingerprint; a wrong fingerprint changes nothing. A changed host key later stops every request (502).
- A refused action never reaches `systemctl`, and the audit log records the host name with every remote action.
- The private key is root-owned and readable by the panel's group. Anyone who can take over the panel can use it to run the bridge's few operations on the listed machines, and nothing else; keep the list short and the panel's 2FA on.
