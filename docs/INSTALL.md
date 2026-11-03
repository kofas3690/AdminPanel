# AdminPanel: installation and setup guide

This guide takes you from a fresh Ubuntu or Debian machine to a working, signed-in panel. Version 0.9.8.

- [1. Requirements](#1-requirements)
- [2. Install the package](#2-install-the-package)
- [3. First-run setup](#3-first-run-setup)
- [4. Open the panel](#4-open-the-panel)
- [5. Terminal and File manager: SSH setup](#5-terminal-and-file-manager-ssh-setup)
- [6. Optional components](#6-optional-components)
- [7. Day-to-day operation](#7-day-to-day-operation)
- [8. Upgrading](#8-upgrading)
- [9. Uninstalling](#9-uninstalling)
- [10. Troubleshooting](#10-troubleshooting)
- [Developing from a git checkout](#developing-from-a-git-checkout)

---

## 1. Requirements

| | |
|---|---|
| **OS** | Ubuntu or Debian (or a derivative) with **systemd**. Developed and tested on Ubuntu |
| **Python** | 3.10 or newer (the installer checks) |
| **Access** | A user with `sudo` |
| **Internet** | Needed during install (Python packages are downloaded from PyPI) |
| **Architecture** | Any (the package is `all`) |

Installed automatically as dependencies: `python3-venv`, `nginx`, `openssl`, `sudo`, `curl`, `iproute2`, `util-linux`, `openssh-client`.

Recommended (installed with the package unless you disable recommends): `openssh-server`, `ufw`, `parted`, `lvm2`, `xfsprogs`, `e2fsprogs`, `mdadm`, `cryptsetup`, `open-iscsi`, `wireguard-tools`, `multipath-tools`, `targetcli-fb`. Without one of these, only the matching page is limited.

> ⚠️ Install only on machines you control. The panel can repartition disks, change networking and manage accounts. Try it in a VM first.

## 2. Install the package

1. Download `adminpanel_0.9.8_all.deb` from the [Releases](https://github.com/kofas3690/AdminPanel/releases) page, or build it yourself (see the README).
2. Install it. Using `apt` (not `dpkg -i`) resolves dependencies:

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.8_all.deb
```

On a remote server, copy the file first: `scp adminpanel_0.9.8_all.deb YOURUSER@SERVER:/tmp/`, then install from `/tmp`.

The installer creates the `adminpanel` service account, a Python environment in `/opt/adminpanel/.venv`, the sudo rules and root helpers, and starts `adminpanel.service`. It ends with:

```
adminpanel: installed. Next step:  sudo adminpanel-setup
```

If the Python packages fail to install, read `/var/log/adminpanel-pip.log`. The usual cause is no internet access from the server.

## 3. First-run setup

```bash
sudo adminpanel-setup
```

It runs these steps in order and is safe to re-run:

| Step | What it does |
|---|---|
| **ssh** | Pins this machine's SSH host key so the Terminal and File manager can trust it |
| **ssh-local** | Allows **password** sign-in over SSH from this machine only (needed on cloud images that disable passwords). Skipped when already allowed |
| **tls** | Creates a self-signed certificate (valid for this machine's addresses) and the nginx site on port **8443** |
| **user** | Creates the panel administrator. The password needs **at least 8 characters** (longer is safer). Setup tells you the rule and asks again if it is too short |
| **2fa** | Shows a QR code. Scan it with an authenticator app, then type the 6-digit code. It also prints **recovery codes**: store them offline |

You can run a single step:

```bash
sudo adminpanel-setup tls --port 9443   # use another port
sudo adminpanel-setup tls --regen       # new certificate
sudo adminpanel-setup user              # add or reset an administrator
sudo adminpanel-setup 2fa               # redo two-step verification
sudo adminpanel-setup ssh               # re-pin the SSH host key
sudo adminpanel-setup ssh-local         # password sign-in over SSH from this machine only
```

Then verify:

```bash
sudo adminpanel-selfcheck
```

You want no `FAIL` lines. `WARN` lines name optional parts that are not set up (for example, a missing firewall tool).

## 4. Open the panel

The panel listens on **TCP 8443** (or the port you chose; `cat /var/lib/adminpanel/port`). The application itself is only on `127.0.0.1:8000`.

### Option A: direct HTTPS

1. Allow the port in your **provider's firewall** (VPS dashboard), preferably only from your own IP (`curl -4 ifconfig.me` on your PC shows it).
2. If `sudo ufw status` says `active`:
   ```bash
   sudo ufw allow from YOUR.PC.IP to any port 8443 proto tcp
   ```
   If it says `inactive`, leave it. If you enable it later, run `sudo ufw allow OpenSSH` first.
3. Browse to `https://SERVER-IP:8443`.

The certificate is self-signed, so the browser warns the first time. The connection is still encrypted.

### Option B: SSH tunnel (recommended for a VPS)

No firewall change, nothing exposed:

```bash
ssh -L 8443:127.0.0.1:8443 YOURUSER@SERVER-IP
```

Keep that window open and browse to `https://localhost:8443`. The certificate covers `localhost`.

### Signing in

Enter the administrator name and password, then the current 6-digit code from your authenticator app (or a recovery code, each usable once).

## 5. Terminal and File manager: SSH setup

These two pages sign in to a **Linux account on the same machine** over SSH, as that account (never `root`). You need:

1. **An SSH server running:** `sudo apt install openssh-server`, then `sudo adminpanel-setup ssh`.
2. **A way to sign in:** a password or an SSH key.

### Password

The account needs a password: `sudo passwd YOURUSER`. On cloud images that disable SSH passwords, run `sudo adminpanel-setup ssh-local`. It allows passwords only for connections coming from the machine itself.

### SSH key (recommended on a VPS)

On the Terminal or File manager page, choose **Sign in with: SSH key**. You can:

- **Generate a key pair** in the page (Ed25519, optional passphrase). It shows the private key once (save it) and a command to run **as the account you will sign in to**, which authorizes the key:
  ```
  from="127.0.0.1,::1",no-agent-forwarding,no-X11-forwarding,no-port-forwarding ssh-ed25519 AAAA... admin-panel
  ```
  The `from=` restriction means the key only works from the server itself, so a stolen copy is useless elsewhere.
- **Or use your own key:** pick the private key file or paste it. OpenSSH and PEM formats work (Ed25519, RSA, ECDSA). PuTTY `.ppk` files must be converted first (PuTTYgen: Conversions, Export OpenSSH key). Hardware keys (`sk-`) and DSA are not supported.

The panel never installs keys for you: authorizing the key is done by you, as that account. The key is used once, held in memory only, and never stored or logged. A key with a passphrase: in the File manager you type the passphrase in the form; in the Terminal, `ssh` asks for it in the terminal.

**Quick test from your PC** that the restriction works: `ssh -i panel_key YOURUSER@SERVER` must fail with `Permission denied (publickey)`.

## 6. Optional components

| Want | Install |
|---|---|
| Firewall page | `sudo apt install ufw` (and allow SSH before enabling) |
| Storage: partitions, LVM, RAID, encryption | `sudo apt install parted lvm2 mdadm cryptsetup xfsprogs` |
| iSCSI initiator / multipath | `sudo apt install open-iscsi multipath-tools` |
| iSCSI **target** | `sudo apt install targetcli-fb` |
| WireGuard VPN | `sudo apt install wireguard-tools` |
| Proxy cache | `sudo apt install squid` |

Refresh the page afterwards. `sudo adminpanel-selfcheck` shows what is detected.

## 7. Day-to-day operation

```bash
systemctl status adminpanel nginx        # service state
sudo journalctl -u adminpanel -n 50      # application log
sudo tail -n 20 /opt/adminpanel/audit.log   # audit trail (JSON lines)
sudo systemctl restart adminpanel        # logs everyone out
```

| Path | Purpose |
|---|---|
| `/opt/adminpanel` | Application, Python environment, `users.json`, `panel.db`, `audit.log` |
| `/var/lib/adminpanel` | Chosen port, WireGuard keys, RAID/VPN/disk-job data |
| `/usr/local/sbin/adminpanel-*` | Root helpers (root-owned) |
| `/etc/sudoers.d/adminpanel*` | The sudo rules (one per helper) |
| `/etc/nginx/sites-available/adminpanel.conf` | Web server site |
| `/etc/ssl/certs/adminpanel.crt`, `/etc/ssl/private/adminpanel.key` | TLS certificate |

**Back up** `/opt/adminpanel/users.json` (accounts and 2FA secrets) and `/opt/adminpanel/panel.db` (sessions). Keep them private (mode 600).

**Locked out or lost your authenticator:** use a recovery code. If you have none, a server administrator can reset on the machine: `sudo adminpanel-setup user` then `sudo adminpanel-setup 2fa`.

## 8. Upgrading

```bash
sudo apt install ./adminpanel_NEW_VERSION_all.deb
sudo adminpanel-selfcheck
```

Your administrator account, certificate, port and settings are kept. The service restarts, so users sign in again.

## 9. Uninstalling

```bash
sudo apt remove adminpanel     # keeps your data and settings
sudo apt purge adminpanel      # deletes /opt/adminpanel, the certificate, the service account
```

Purging leaves settings the panel made for the machine: network files `/etc/systemd/network/05-ap-*`, lines marked `adminpanel` in `/etc/fstab` and `/etc/crypttab`, and RAID, VPN and disk-job data in `/var/lib/adminpanel`. Remove them by hand if you want them gone.

## 10. Troubleshooting

| Symptom | Check / fix |
|---|---|
| Page does not load from outside | `curl -k https://127.0.0.1:8443/login.html` on the server. If that gives HTML, the panel is fine: open the port in the provider firewall and `ufw`, or use the SSH tunnel |
| Nothing listens on 8443 | Setup has not run, or you chose another port: `cat /var/lib/adminpanel/port`. Run `sudo adminpanel-setup tls` |
| `502 Bad Gateway` | The application is down: `sudo journalctl -u adminpanel -n 30` |
| `adminpanel-selfcheck` shows FAIL | The line names the part. Re-run `sudo adminpanel-setup` for setup problems |
| "Port 8443 is already used" | `sudo adminpanel-setup tls --port 9443` |
| Install fails installing Python packages | The server needs internet; see `/var/log/adminpanel-pip.log`. On unusual CPUs install `build-essential python3-dev libffi-dev` |
| "Python 3.10 or newer is required" | Use Ubuntu 22.04+ or Debian 12+ |
| 2FA code is always wrong | The server clock is off: `timedatectl`, enable NTP (`sudo timedatectl set-ntp true`) |
| Login says too many attempts (429) | Wait a minute; login is rate limited |
| Terminal/File manager: "host key" or cannot connect | `sudo apt install openssh-server`, `sudo adminpanel-setup ssh` |
| Terminal/File manager: wrong user or password | Account needs a password (`sudo passwd NAME`) and `sudo adminpanel-setup ssh-local` on cloud images, or use an SSH key |
| SSH key: "did not accept that key" | The key is not authorized for that account. Add the public key line to that account's `~/.ssh/authorized_keys` |
| SSH key: "does not look like a private key" | Use the private file (not `.pub`), whole file from `-----BEGIN` to `-----END`. Convert `.ppk` files |
| Services / Logs pages empty | `sudo adminpanel-selfcheck`; the panel account must read the journal (group `systemd-journal`) |
| Network change cut me off | It rolls back by itself after the timeout if not confirmed. Wait, or use the provider's console |

Still stuck? Open an issue with the output of `sudo adminpanel-selfcheck` and `sudo journalctl -u adminpanel -n 50 --no-pager` (remove anything private).

---

## Developing from a git checkout

The supported install is the package. For development on a test machine:

```bash
git clone https://github.com/kofas3690/AdminPanel.git ~/adminpanel
cd ~/adminpanel
# Install the package once for the user, sudo rules and helpers, then deploy your working copy over it:
./deploy.sh        # rsyncs ~/adminpanel to /opt/adminpanel, restarts when .py files changed
```

`deploy.sh` expects the checkout at `~/adminpanel` and an installed package. Always run the application as the `adminpanel` user (through systemd), not as your own user, or file permissions break. After adding a Python module, add it to `MODULES` in `packaging/build.sh`.
