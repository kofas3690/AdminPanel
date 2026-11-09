**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.4.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Processes** (new sidebar entry, under *Services*). A live list of every process: number, name, user, CPU share, memory, state, start time and command line. Sort by any column, filter by name, user, number or command, hide root and system accounts, and refresh every 3 seconds (stops when the tab is hidden). The top shows totals and the load average.
- **End** and **Force quit** for ordinary programs: *End* asks the program to stop (TERM), *Force quit* stops it at once (KILL). Each asks for confirmation and is written to the audit log with the process, user and signal.

### Security note
- A new root helper, `adminpanel-proc`, with exact sudo rules (`signal *` and a self-check). It refuses processes owned by root or by the panel, core system processes (`systemd`, `sshd`, `dbus-daemon` and similar), the helper itself and process 1. Services are stopped from the Services page, not here.
- The panel sends the process number **and its start time**. The helper opens a handle on the process, checks that it is still the same process, and sends the signal through that handle, so if a program ended and another reused its number, nothing is signalled.
- The remote-management account (Servers page) does **not** get this rule.
