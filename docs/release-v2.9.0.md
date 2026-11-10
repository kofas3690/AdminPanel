**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.9.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Restart status** on the *Software updates* page. It says whether a reboot is needed, how long it has been waiting, which packages asked for it, the running kernel compared with the newest one installed, and how long the machine has been up.
- **Alerts.** A reboot that has been waiting for 7 days or more raises a warning, because the updates are not fully in effect until the machine restarts.

### Notes
- Read only, and no new root helper or sudo rule: everything comes from files any account can read (`/run/reboot-required`, `/run/reboot-required.pkgs`, `/boot`).
- Only kernels of the same flavour as the running one (for example `-generic` or `-aws`) are compared.
