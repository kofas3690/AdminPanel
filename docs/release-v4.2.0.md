**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Swap** (a tab beside *Storage*, *Disk usage* and *Network shares*). Shows memory, swap total and free, free disk space and the swap that is active. Small cloud machines often have no swap, and then run out of memory and start killing programs. You can **create a swap file** of a chosen size (it is turned on at once and added to `/etc/fstab` so it returns after a restart), **remove** it (asks first), and set **swappiness**, which is saved for the next boot too. The page offers only sizes that leave at least 1 GB of the disk free.

### Security note
- A new root helper, `adminpanel-swap`, touches only one file, `/swapfile`, and accepts only a size in megabytes (128 to 65536), a swappiness number (0 to 100), `status` and `remove`, with exact sudo rules. No path, device or command line from the caller reaches a program. It refuses to replace an existing file, refuses a size that would leave less than 1 GB free, and cleans up if any step fails. `/etc/fstab` is rewritten atomically. The remote-management account (Servers page) does **not** get these rules.
