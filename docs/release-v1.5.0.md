**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.5.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### New
- **Reboot and Shut down for other machines.** On the Remote services page, a new *Power* row under the machine's services. Each button asks you to type the machine's name from the list before it does anything. The panel writes `remote_power` (and `remote_power_failed` if it did not work) to the audit log with who, from where and which machine.
- The machine refuses while a software update (`apt` or `dpkg`) is running there, and says so.
- A machine that is shut down must be started again from outside (power button, or your hosting provider's console).

### To use it on a managed machine
The other machine needs the new package and a refreshed sudo rule:
```bash
sudo apt install ./adminpanel_1.5.0_all.deb
sudo adminpanel-setup remote-enable 'ssh-ed25519 AAAA... adminpanel-central'
```
(the same `remote-enable` line as before; run `sudo adminpanel-setup remote-key` on the central panel to print it again). If you skip this, the button explains what is missing instead of failing silently.

### Under the hood
- The bridge has one new operation, `power.act`, which accepts only `reboot` or `poweroff`. It checks everything first (update running, sudo rule present), sends its answer, and only then starts the shutdown, so the central panel always gets a clear reply.
- The sudo rules are the two added in 1.4.0 (`systemctl --no-block reboot` and `poweroff`, exact arguments); `remote-enable` copies them for the bridge's account.
- The update check and the command now live in `actions.py` and are shared by the local Power buttons and the bridge.
