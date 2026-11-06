**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.6_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Set up other machines with `adminpanel-setup`.** Three steps: `sudo adminpanel-setup remote-key` on the central panel prints a command; run it on the other machine (`remote-enable`) to let the panel's key run the bridge and nothing else; then `sudo adminpanel-setup add-host NAME ADDRESS` on the central panel shows the other machine's SSH host key fingerprint, asks you to confirm it, pins it and tests the connection. Also `list-hosts`, `remove-host NAME` and `remote-disable`. The Servers and Services pages do not use this yet; a host selector comes next. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).

### Security
- The panel's key for other machines and the pinned host keys are root-owned: the panel can read them but cannot change them.
- `remote-enable` accepts only a plain `ssh-ed25519` key line, creates a user with no password, and gives the key a forced command with `restrict`. `add-host` changes nothing unless the fingerprint is confirmed.
