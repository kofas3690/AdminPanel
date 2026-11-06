**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.5_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Foundation for managing other machines from one panel (not visible yet).** A small program, `bridge.py`, can run on another machine over SSH and do only a fixed list of operations (`ping`, `services.list`, `services.act`). The panel has a client for it (`remote.py`) and the Services routes accept `?host=<id>`. There is no host selector and no add-host command yet; they come in the next releases. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).

### Changed
- The service list and the start/stop/restart logic moved from `services.py` into `actions.py` so the panel and the bridge share one copy. On this machine the commands, the checks and the audit entries are unchanged.

### Security
- The bridge refuses unknown operations, extra arguments, malformed requests and requests over 64 KB, and re-checks the service name and action itself. A remote host's SSH key is checked against a root-owned list of pinned host keys that the panel cannot change.
