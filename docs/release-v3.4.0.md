**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.4.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Network shares** (a tab beside *Storage*). Connect Windows (SMB) file shares, such as a NAS or another computer's shared folder: add a share with its server, share name, user and password, then **Test**, **Connect**, **Disconnect** or **Remove** it. Shares are mounted under `/mnt/adminpanel/NAME`.
- Each share is used either for **Backups** (only root can see inside it) or for the **File manager** (everyone with an account can read it, nobody can change it from here). It cannot be both, because a world-readable mount would let any local user read the backup copies.
- **Backups can now be stored on a network share.** A new *Store copies on* choice on the Backups page lists the shares set up for backups. The share is connected automatically when a backup starts, copies are kept and pruned the same way as before, and the page shows free space on the share and the right restore path.
- Safety: a backup never writes unless the share is really mounted, so a missing mount cannot fill this machine's own disk. A share that is the backup destination cannot be removed until you pick another destination.
- The package now recommends `cifs-utils` (needed for SMB). If it is missing, the page says so and links to the Packages page.

### Security note
- A new root helper, `adminpanel-share`, with seven exact sudo rules (`list`, `add`, `check`, and `mount`, `unmount`, `test`, `remove` with a name). It checks every value again as root: names, server (a host name or IPv4 address), share, user and domain are matched against strict patterns, so nothing can add mount options.
- Passwords are sent on standard input (never on a command line), kept in a root-only file per share, and never sent back to the browser. Shares are mounted `nosuid,nodev,noexec`; File manager shares are also read-only.
- The remote-management account (Servers page) does **not** get these rules.
