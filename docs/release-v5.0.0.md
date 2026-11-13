**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_5.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Compose** (a tab in the *Services* group, next to *Containers*). Manages Docker Compose projects, the stacks of containers that belong together. Each project shows its services (container, image, state, ports) and has buttons to **Start**, **Stop**, **Restart**, **Pull images** (download newer images) and **Apply (up -d)**, which recreates only the containers whose image or settings changed. It can also show the project's log and its compose file, with the values of keys that look like passwords, secrets or tokens hidden. The output of each action is shown on the page. If Docker or the Compose plugin is missing the page says so and which package to install.
- Only projects Docker already knows about are listed (a project appears after it has been started once with `docker compose` on the command line). Creating and removing projects stays on the command line on purpose.

### Security note
- Access to Docker is the same as root, so the new root helper, `adminpanel-compose`, is deliberately narrow. It accepts only `list`, `start`, `stop`, `restart`, `pull`, `up`, `logs`, `file` and `check`, with exact sudo rules. A project is named by its Compose project name, which must be one Docker itself lists, and the helper uses the compose files Docker recorded for it. It cannot create a project, run `down`, remove volumes or images, or run a command inside a container. Every action is recorded in the audit log. The remote-management account (Servers page) does **not** get these rules.
