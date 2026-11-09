**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.5.0_all.deb
sudo apt install smartmontools      # needed to read disk health; the package only recommends it
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Disk health** (*Storage* → *Health* tab). One row per physical disk with a Good, Warning, Failing, Asleep or Not available badge, the model, type (hard disk, SSD, NVMe), size, temperature, time powered on and, for NVMe, wear. The reasons are shown in plain words, for example "24 reallocated sectors" or "The drive is 93% worn".
- **Alerts.** A failing disk raises a critical alert and a disk with warning signs raises a warning on the Alerts page (and by email if you set that up). The reading is refreshed in the background about once an hour; *Check again* reads it now.
- Disks that are asleep are not woken just to read their health. Virtual and cloud disks usually don't report SMART and show *Not available*.

### Security note
- A new read-only root helper, `adminpanel-smart`, with two exact sudo rules (`report` and `check`). It takes no disk names from the caller: it lists the disks itself and runs `smartctl` with fixed options.
- The remote-management account (Servers page) does **not** get these rules.
- Package: `smartmontools` is now a *recommended* package (not required).
