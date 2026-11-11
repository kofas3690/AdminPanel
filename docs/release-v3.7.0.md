**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.7.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Containers** (a tab beside *Services* and *Cron jobs*). Lists the Docker containers on the machine with their image, state, status and ports. You can **start, stop and restart** a container (stop and restart ask first) and read the **last 300 lines of its log**. If Docker is not installed, or its service is stopped, the page says so and what to do (install `docker.io` on the Packages page, or start the `docker` service).

### Security note
- Access to Docker is the same as root, so a new root helper, `adminpanel-docker`, allows only `list`, `start`, `stop`, `restart` and `logs`, with exact sudo rules. It cannot run, create, remove or copy into a container, or run commands inside one: that stays on the command line on purpose.
- A container is named by its full 64-letter id, and the helper only acts on an id that Docker itself lists. Names, images and logs are shown as plain text (control and colour codes removed).
- The remote-management account (Servers page) does **not** get these rules.
