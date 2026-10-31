# 🛡️ AdminPanel

### A Linux System Administration Dashboard

AdminPanel is a Python-based Linux system administration application designed to provide a centralized interface for managing and monitoring Linux systems.

It brings essential system administration operations into one place, helping administrators manage users, services, networking, storage, security, firewall configurations, and system logs.

The project aims to simplify Linux server administration through an organized, modular, and user-friendly management interface.

---

## ✨ Features

AdminPanel provides a collection of system administration modules.

### 🔐 Authentication & Security

* User authentication and access management.
* Security management.
* Two-factor authentication enrollment.
* Administrative activity auditing.

### 👥 User Management

* Manage system users.
* Create and manage user accounts.
* User administration tools.

### ⚙️ System Management

* Monitor system information.
* Manage system services.
* View system logs and journals.
* Manage system updates.
* Manage systemd units.

### 🌐 Network Management

* Network information and management.
* Firewall management through UFW.
* Network administration utilities.

### 💾 Storage Management

* Monitor disk usage.
* Manage storage resources.
* Browse and manage files.
* Filesystem administration.

### 📋 System Monitoring

* View system logs.
* Inspect system journals.
* Monitor system resources.
* Audit administrative activities.

---

## 🏗️ Architecture

AdminPanel follows a modular architecture that separates application functionality into independent components.

The application includes modules for:

| Module          | Responsibility                       |
| --------------- | ------------------------------------ |
| `app`           | Main application                     |
| `auth`          | Authentication                       |
| `audit`         | Administrative auditing              |
| `store`         | Application data storage             |
| `system`        | System information and management    |
| `services`      | Service management                   |
| `logs`          | Log management                       |
| `updates`       | System updates                       |
| `firewall`      | Firewall administration              |
| `users`         | User management                      |
| `terminal`      | Terminal functionality               |
| `storage`       | Storage management                   |
| `storage_admin` | Storage administration               |
| `files`         | File management                      |
| `fs`            | Filesystem operations                |
| `network`       | Network management                   |
| `security`      | Security management                  |
| `journal`       | System journal management            |
| `units`         | Systemd unit management              |
| `userunits`     | User systemd unit management         |
| `create_user`   | User creation                        |
| `enroll_2fa`    | Two-factor authentication enrollment |

---

## 🛠️ Technology Stack

AdminPanel uses the following technologies and system utilities:

* **Python** – Core application development.
* **Linux** – Target operating system.
* **APT** – Package management integration.
* **UFW** – Firewall management.
* **systemd** – Service and unit management.
* **Debian Packaging** – Application distribution.
* **Git** – Version control.

The project uses isolated Python execution for its packaged administrative helper scripts.

---

## 📦 Installation

### Option 1: Install Using the Debian Package

Download the latest `.deb` package from the GitHub Releases section.

For example:

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.0_all.deb
```

APT will handle the package installation and dependency resolution.

### Option 2: Clone the Repository

Clone the project:

```bash
git clone https://github.com/kofas3690/AdminPanel.git
```

Navigate into the project:

```bash
cd AdminPanel
```

Install the required system dependencies and Python packages according to the project's installation configuration.

> Note: Source installation instructions and the application startup command will be documented as the installation workflow is finalized.

---

## 🔨 Building from Source

AdminPanel includes packaging scripts for collecting application files and building a Debian package.

### Step 1: Collect Application Files

```bash
bash packaging/collect.sh
```

This collects the required application files and administrative helper scripts.

### Step 2: Build the Debian Package

```bash
bash packaging/build.sh
```

The build process performs validation checks, including:

* Python module validation.
* Python import checks.
* Static asset validation.
* Administrative helper script validation.
* Sudoers configuration validation.
* Dependency packaging.

A successful build produces a Debian installation package.

---

## 📁 Project Structure

The project is organized into application modules, system administration helpers, and packaging resources.

```text
AdminPanel/
│
├── app/
│   ├── auth/
│   ├── audit/
│   ├── system/
│   ├── services/
│   ├── logs/
│   ├── updates/
│   ├── firewall/
│   ├── users/
│   ├── storage/
│   ├── network/
│   ├── security/
│   └── ...
│
├── system/
│   ├── adminpanel-apt
│   ├── adminpanel-ufw
│   ├── adminpanel-users
│   ├── adminpanel-net
│   ├── adminpanel-disk
│   └── adminpanel-userunits
│
├── packaging/
│   ├── collect.sh
│   ├── build.sh
│   └── live/
│
└── README.md
```

*The structure above is a simplified architectural overview.*

---

## 🔒 Security

AdminPanel interacts with sensitive Linux system resources and administrative operations.

Security is an important consideration throughout the project.

The project includes:

* Authentication-related functionality.
* Administrative activity auditing.
* Dedicated system administration helpers.
* Isolated Python execution for packaged Python helpers.
* Sudoers configuration validation during packaging.

**Security recommendations:**

* Run administrative operations with appropriate privileges.
* Do not expose administrative interfaces to untrusted networks.
* Protect authentication credentials.
* Review privileged permissions before deployment.
* Keep the operating system and application updated.

---

## 🚧 Development Status

AdminPanel is actively being developed.

The project is undergoing continuous improvements in functionality, security, packaging, and system integration.

Features and implementation details may change between releases.

---

## 🗺️ Roadmap

Planned areas of improvement include:

* [ ] Improve system monitoring.
* [ ] Expand security management capabilities.
* [ ] Improve network administration.
* [ ] Expand user management functionality.
* [ ] Improve application logging and auditing.
* [ ] Enhance Debian package distribution.
* [ ] Automate testing and releases using GitHub Actions.
* [ ] Improve documentation.

---

## 🤝 Contributing

Contributions, suggestions, bug reports, and feature requests are welcome.

To contribute:

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/new-feature
```

3. Make your changes.
4. Commit your changes.

```bash
git add .
git commit -m "Add new feature"
```

5. Push your branch.

```bash
git push origin feature/new-feature
```

6. Open a Pull Request.

---

## 📄 License

License information will be added when the project's license is finalized.

---

## 👨‍💻 Author

**Kofi Agyapong Agyemang**

GitHub: [@kofas3690](https://github.com/kofas3690)

---

## ⭐ Support

If you find AdminPanel useful, consider giving the project a star on GitHub.

Your support and feedback help improve the project.

**AdminPanel – Simplifying Linux System Administration.**
