**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.0.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **Smoother network graphs.** The Network card on Overview and the Network chart under *History* now draw smooth curves with a soft fade under the *Down* line, instead of jagged straight segments. The curve never dips below zero or overshoots a spike, and gaps in the history still show as breaks.
- The Network card now uses the same colours as the History chart: blue for *Down*, green for *Up*.
