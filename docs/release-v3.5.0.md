**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.5.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Backups can be stored on any disk mounted under `/mnt`**, including an iSCSI disk. Connect the iSCSI target, then format and mount the disk on the *Storage* page as before (it appears under `/mnt/NAME`); it is then listed in the new *Store copies on* choice on the Backups page, with its file system and free space.
- Only a whole disk with a file system that keeps Unix permissions (ext2/3/4, XFS, Btrfs, F2fs) is offered, so copies stay readable by root only. Bind mounts, network shares and FAT/NTFS disks are not offered.
- A backup only writes when the disk really is mounted. If the disk is missing (for example the iSCSI session is down after a reboot), the backup fails with a clear message instead of filling this machine's own disk, and the Backups page says to mount it on the Storage page.

### Notes
- iSCSI itself (discovery, login, reconnect, start-up login) was already on the Storage page; this release connects it to Backups.
- No new root helper and no new sudo rules: the existing backup helper reads `/proc/self/mountinfo` and re-checks the choice as root.
