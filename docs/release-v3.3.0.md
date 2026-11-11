**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.3.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Disk usage** (a tab beside *Storage*). Shows what is taking the space inside any folder: each item directly inside it with its size, a share bar and file count, biggest first. Click a folder to look inside it; breadcrumbs and an *Up* button move around, and the header shows how full the filesystem is.
- Sizes are the disk space actually used, hard-linked files are counted once, and only the filesystem the folder is on is counted (other mounted filesystems are marked, not added in).
- Very large folders stop after about 25 seconds and say the sizes are a lower bound, so the page never hangs.

### Security note
- A new read-only root helper, `adminpanel-du`, with two exact sudo rules (`scan *` and `check`), because ordinary accounts cannot read most system folders. It reads **metadata only**: it never opens a file and never follows a symlink. It refuses a path that is relative or goes through a symlink, and only lists a folder's items; nothing is changed, deleted or downloaded.
- The remote-management account (Servers page) does **not** get these rules.
