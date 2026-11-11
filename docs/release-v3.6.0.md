**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.6.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **NFS shares** on the *Network shares* page, next to SMB. Pick the type, enter the server and the export folder on it (for example `/srv/backups`) and choose NFS 4.2, 4.1, 4.0 or 3. Test, Connect, Disconnect and Remove work the same way, and a share is again either for **Backups** (root only) or for the **File manager** (read only for everyone).
- Backups can store copies on an NFS share exactly like an SMB one, with the same safety: nothing is written unless the share is really mounted.
- The package now also recommends `nfs-common` (needed for NFS). If it is missing the page says so and links to the Packages page.

### Notes
- NFS has no password in this panel. The server decides who may mount an export, usually by this machine's address, so allow this machine in the server's exports. If the server squashes root, writing a backup may be refused; use `no_root_squash` on the backup export.
- No new root helper and no new sudo rules: the existing `adminpanel-share` helper checks the export path again as root (a full path with no `..`, no trailing `/` and only letters, digits and `. _ - /`), so nothing can add a mount option.
