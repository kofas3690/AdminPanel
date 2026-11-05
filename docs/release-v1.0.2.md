**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.2_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Signing in to the Terminal with an SSH key now works.** The Terminal showed `no such identity: /dev/fd/16` and `Permission denied`. The key was handed to `ssh` as an open file, but `ssh` closes every file it did not open itself when it starts, so it never saw the key. The key is now written to a private file (mode 600, in its own mode 700 folder, in RAM under `/dev/shm`) just before `ssh` starts, and removed after 30 seconds or when the session ends, whichever comes first. The File manager's key sign-in was not affected.

### Changed
- The key is no longer described as "held in memory only": for up to 30 seconds it exists as a RAM-backed file readable only by the panel's own account. It is still never logged, and never written to a disk.
