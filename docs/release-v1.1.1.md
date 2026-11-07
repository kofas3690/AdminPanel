**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.1.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **Audit log shows the machine's name.** Entries for actions on another machine (`service_action`, `remote_logs_read`) now carry `host_name` (for example `"host_name": "ubuntu"`) next to the short `host` id, so the log can be read without looking the id up. Entries for this machine are unchanged.

Nothing needs to be done on the other machines: only the panel machine changes.
