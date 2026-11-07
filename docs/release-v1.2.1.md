**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.2.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **No boot state for `ssh`.** On Ubuntu 24.04 SSH starts through `ssh.socket`, so the `ssh` service itself reads "disabled" even though SSH comes up at boot. The Services tables no longer show a boot state for `ssh`, because it only looked like a problem.
- **Remote services page text** now says that services can also be set to start at boot.

Nothing needs to be done on the other machines: only the panel machine changes.
