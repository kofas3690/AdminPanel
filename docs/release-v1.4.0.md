**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.4.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### New
- **Reboot and Shut down buttons** in a new *Power* section at the bottom of the Overview page. Each asks you to type the machine's own name before it does anything, so a stray click cannot restart a server. A machine that is shut down has to be started again from outside (power button, or your hosting provider's console).
- The buttons refuse while a software update (`apt` or `dpkg`) is running, because stopping one half way can leave packages broken.
- Every attempt is written to the audit log first (`power_action`, `power_refused`, `power_failed`), with who, from where and which machine.

### Under the hood
- New module `power.py` with `POST /api/power/reboot` and `POST /api/power/poweroff`. The command runs after the answer has been sent.
- Two new sudo rules: `systemctl --no-block reboot` and `systemctl --no-block poweroff`, with those exact arguments.
- This works on the machine the panel runs on. Other machines on the Remote services page are not affected.
