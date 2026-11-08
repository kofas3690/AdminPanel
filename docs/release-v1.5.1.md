**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.5.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Reboot and Shut down said "A software update is running" when none was.** On Ubuntu a background program, `unattended-upgrade-shutdown`, runs all the time, waiting for the machine to shut down. It has the same short process name as a real unattended upgrade, so the check mistook it for one. The check now tells them apart by their command line. This affected the buttons on the Overview page, the *Reboot required* chip, and rebooting other machines; the other machines need the new package too, because the check runs there.
- The refusal now names the process that is running (for example `dpkg`), so you can see what it is waiting for.

### Still protected
A real update (`apt`, `apt-get`, `dpkg` or an unattended upgrade in progress) still blocks Reboot and Shut down until it has finished.
