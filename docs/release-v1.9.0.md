**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.9.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **History graphs on the Overview page.** Under the four cards there are now four charts: **CPU**, **Memory**, **Disk (/)** and **Network** (down and up). Choose the last hour, 6 hours, 24 hours or 7 days. Hover a chart to read the exact value and time; the latest value is shown at the top right of each chart.
- The panel records **one sample a minute** and keeps **seven days** (about 10,000 small rows in the panel database, well under 1 MB). Longer ranges show averages, so a short spike can look lower on the 7-day view.
- **Gaps are real.** While the panel or the machine is not running nothing is recorded, and the chart shows a break instead of a made-up line. After an install or a reboot the charts start filling within a couple of minutes.

### Notes
- Nothing leaves the machine; the history lives in the panel's own database, and the new `/api/metrics` endpoint needs a signed-in session like every other one.
- The CPU history is calculated separately from the live CPU card, so the two do not disturb each other.
