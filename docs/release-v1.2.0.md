**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Enable and disable at boot.** The Services table on the Overview page and the Remote services page now show whether each service starts at boot ("active/running · boot: enabled") and offer one button to change it: "disable at boot" for an enabled service, "enable at boot" for a disabled one. These only change what happens at the next boot. They never start or stop the service now.
- Works for `nginx` and `cron`, on this machine and on other machines through the bridge. `ssh` is deliberately left out, so a mistake cannot stop you signing in after a reboot.
- Every change is written to the audit log like the other service actions (`service_action`, with `host` and `host_name` for other machines).

### Upgrade notes
- **This machine:** nothing to do. The package installs the new sudo rule.
- **Other machines you manage:** install 1.2.0 there, then run `sudo adminpanel-setup remote-enable 'ssh-ed25519 AAAA... adminpanel-central'` once more. Without it the new buttons answer "This machine's sudo rule is older. Run 'sudo adminpanel-setup remote-enable' there again"; everything else keeps working. The key is the line already in `/var/lib/adminpanel-remote/.ssh/authorized_keys` (its last two fields).
