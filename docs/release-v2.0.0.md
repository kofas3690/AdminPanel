**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Hardware page** (System, after Storage): what the machine is made of, all in one place.
  - **System:** vendor, model, board, firmware version and date, and whether it is a physical machine or a virtual one.
  - **Processor:** model, sockets, cores, threads, speed range and caches.
  - **Memory:** total, available and swap, and (on real hardware) each **memory module** with its slot, size, type, speed and maker.
  - **Disks:** every disk and its partitions as a tree, with size, model, bus (NVMe, SATA, USB), file system and where it is mounted; SSD/flash and hard disks are told apart.
  - **Temperatures and sensors:** every temperature with its warning and critical limits (a value above its warning limit turns amber, above critical red), fans and battery. Refreshes by itself every five seconds.
  - **PCI devices** (with a filter box, so you can find "ethernet" or "nvidia" quickly) and **USB devices**.
- Where a machine has no such hardware, or a tool is missing, the section says so and how to install it, instead of staying blank. Virtual machines and cloud servers usually show no temperatures and no memory modules; that is normal.

### Security notes
- The page only **reads**. The one thing that needs root, listing the memory modules, goes through a new sudo rule that allows exactly `dmidecode -t memory` and nothing else. The rule is not given to the remote-management user created by `adminpanel-setup remote-enable`.
- Needs the standard tools `pciutils` and `usbutils` (installed by default on Ubuntu Server); `dmidecode` for the memory modules.
