**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.3.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Backups** (new sidebar entry, under *Storage*). Choose the folders to save, a schedule (off, every day or every week, from an hour you pick) and how many copies to keep. *Back up now* starts a copy at once; each copy can be checked (the archive is read back to make sure it is not damaged) or deleted.
- Copies are `.tar.gz` files in `/var/backups/adminpanel`, readable only by root. The panel can list, check and delete them but cannot read what is inside, and the page shows the console command to restore.
- The schedule runs from a systemd timer that checks every hour whether a copy is due, so a machine that was off at the chosen hour makes its copy when it is next running. If a backup fails, the existing *failed service* alert on the Alerts page reports it, and the Backups page shows the reason.

### Security note
- A new root helper, `adminpanel-backup`, with exact sudo rules (`status`, `set`, `start`, `verify NAME`, `delete NAME`). The helper checks everything again as root: full paths only, no `..`, the folder must exist, `/proc`, `/sys`, `/dev`, `/run` and the backup folder itself are refused, and file names must match the backup pattern exactly. Settings are saved only by the helper, in a root-only file.
- The remote-management account (Servers page) does **not** get these rules.
- A copy on the same disk does not protect against losing the disk: copy `/var/backups/adminpanel` somewhere else as well.
