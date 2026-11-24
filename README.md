# ⚡ Super Port (Dev Port Killer & Traffic Inspector)

> Instant 1-Click Port Killer, Dev Server Restarter & Live Traffic Inspector for Windows and VS Code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D4.svg)](https://microsoft.com)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org)

---

## 💥 The Pain Point

Every developer encounters this multiple times a day:

```text
Error: listen EADDRINUSE: address already in use :::3000
Error: listen EADDRINUSE: address already in use 0.0.0.0:4200
Error: listen EADDRINUSE: address already in use :::8080
```

On Windows, finding and killing the ghost process requires tedious, multi-step terminal commands:
```powershell
netstat -ano | findstr :3000
taskkill /PID 18420 /F
```

If the parent process spawned child processes (common with `npm run dev`, `vite`, `next`), killing the parent leaves zombie children holding the port. Developers lose 2–3 minutes repeatedly throughout the day.

---

## ⚡ The Visual Solution

**Super Port** eradicates port collisions entirely:

1. **Subtle Status Bar Item**:
   - Shows active dev servers, port number, framework, and memory consumption (e.g. `⚡ :3000 (Vite) | 142 MB`).
   - Click to trigger instant 1-click kill or open the dashboard.
2. **Activity Bar Sidebar**:
   - Dedicated TreeView categorizing **Active Dev Servers**, **Databases & Containers**, and **Other Listening Ports**.
   - Hover actions: `[⚡ Kill Port]`, `[🔄 Restart Dev Server]`, `[🔍 Inspect Traffic]`, `[🌐 Open in Browser]`, `[📋 Copy URL]`.
3. **Interactive QuickPick (`Ctrl+Shift+P` -> `Super Port: Quick Kill`)**:
   - Fast keyboard-driven fuzzy search to kill ports or execute **"💥 Kill ALL Active Dev Ports"** in one tap.
4. **Rich Cyberpunk Webview Dashboard**:
   - Full traffic analytics, memory meters, real-time client IP inspection, filter by framework, and auto-refresh selector.
5. **Terminal Collision Sentinel**:
   - Automatically detects `listen EADDRINUSE` errors in VS Code terminals and displays a 1-click notification:  
     `⚡ Port 3000 is occupied by node.exe (Vite, PID 18420). [⚡ Kill Port 3000] [View Dashboard]`
6. **Standalone CLI & Web Dashboard Companion**:
   - Works seamlessly outside VS Code via `super-port` CLI or `super-port ui` standalone server.

---

## 🚀 Features at a Glance

| Feature | Description |
|---|---|
| **⚡ 1-Click Kill** | Uses `taskkill /PID <PID> /F /T` to forcefully terminate the entire process tree on Windows. |
| **🔄 Restart Server** | Kills the existing ghost process and preps clean re-run without manual terminal hunting. |
| **📡 Traffic Inspector** | Analyzes TCP connection states (`ESTABLISHED`, `TIME_WAIT`, `CLOSE_WAIT`) and remote client IPs. |
| **🧠 Smart Framework Detection** | Automatically recognizes Vite, Next.js, Angular, React, Vue, Nuxt, SvelteKit, Astro, Remix, Python FastAPI/Flask/Django, Docker, Spring Boot, Go, Rust, and Databases. |
| **💥 Kill All Dev Ports** | 1-Click mass terminator for all active local development servers. |
| **🛡️ System Protection** | Built-in safety guards preventing accidental termination of Windows core services (PID 0, 4, `svchost.exe`, `csrss.exe`). |
| **⚡ Blazingly Fast** | Native Windows `netstat -ano` and cached WMI/CIM pipeline executes in **< 35ms** with zero system lag. |

---

## 💻 Tech Stack

- **Runtime & Language**: Node.js, TypeScript (ES2022)
- **Windows APIs**: Windows PowerShell, `netstat -ano -p tcp`, `taskkill /F /T`, WMI/CIM `Win32_Process`
- **IDE Integration**: VS Code Extension API (Webview, TreeView, StatusBarItem, QuickPick, Terminal Watcher)
- **Frontend UI**: Vanilla ES6+, CSS Glassmorphism, Responsive Grid (Zero bloat, instant load)

---

## 📦 Getting Started

### 1. Build and Run the VS Code Extension

```bash
# Clone the repository
git clone https://github.com/pratik-maurya/super-port.git
cd "super port"

# Install dependencies
npm install

# Build the project
npm run build

# Run unit & integration tests
npm test
```

To test inside VS Code:
1. Open the folder in VS Code.
2. Press `F5` (or run `Launch Extension`) to open an Extension Development Host window.
3. The `⚡ Super Port` status bar item and sidebar icon will activate automatically!

---

### 2. Standalone CLI Usage

Super Port includes a standalone CLI that works anywhere on Windows without VS Code:

```bash
# List all active dev servers, ports, PIDs, and RAM
node bin/super-port.js ls

# Include system & background ports
node bin/super-port.js ls --all

# 1-Click kill a port by number
node bin/super-port.js kill 3000

# Terminate all active dev servers at once
node bin/super-port.js kill-all

# Inspect live traffic & client connections on port 5173
node bin/super-port.js traffic 5173

# Launch the visual Web Dashboard in your browser
node bin/super-port.js ui
```

---

## ⌨️ VS Code Commands & Keybindings

Open the Command Palette (`Ctrl+Shift+P` on Windows / `Cmd+Shift+P` on Mac):

| Command | Action |
|---|---|
| `Super Port: Open Traffic & Port Inspector` | Launches the interactive cyberpunk Webview Dashboard |
| `Super Port: ⚡ Quick Kill Port...` | Opens keyboard QuickPick to search & kill ports |
| `Super Port: Refresh Active Ports` | Force re-scans all ports and updates status bar |
| `Super Port: 💥 Kill All Active Dev Ports` | Terminates all running dev servers in parallel |
| `Super Port: Kill Port Process` | Prompts for a port number to kill |

---

## ⚙️ Configuration Settings

Customize behavior in VS Code `settings.json`:

```json
{
  // Auto refresh interval in seconds (0 = disabled)
  "superPort.autoRefreshInterval": 3,

  // Automatically detect EADDRINUSE in terminal and show 1-click kill notification
  "superPort.alertOnEADDRINUSE": true,

  // Include system ports (< 1024) in the explorer view
  "superPort.showSystemPorts": false,

  // Standard development ports highlighted with high priority
  "superPort.customDevPorts": [3000, 3001, 4200, 5000, 5173, 8000, 8080, 8888]
}
```

---

## 🧪 Architecture & Safety

```text
[ Windows Network Subsystem ]
              │
              ▼
    netstat -ano -p tcp  (32ms blazingly fast scan)
              │
              ├──────────────────────────────────┐
              ▼                                  ▼
     [ LISTENING Ports ]               [ ESTABLISHED / Traffic ]
              │                                  │
              ▼                                  ▼
   Cached CIM / Win32_Process             Traffic Inspector
 (Resolve PID, Name, RAM, CmdLine)     (Remote IPs, TCP States)
              │                                  │
              ▼                                  │
   Framework Detector (Vite, Next, etc.)         │
              │                                  │
              └───────────────┬──────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────┐
    │              Super Port Core Engine                 │
    └─────────────────────────────────────────────────────┘
              │                           │
              ▼                           ▼
    [ VS Code Extension ]        [ Standalone CLI / Web ]
    • Status Bar Item            • Terminal Colored Table
    • Activity Bar TreeView      • 1-Click `kill 3000`
    • QuickPick Menu             • `kill-all` Dev Servers
    • Webview UI Dashboard       • Localhost Dashboard Server
    • EADDRINUSE Sentinel        • Browser Auto-Launcher
```

### Process Tree Termination (`taskkill /PID <PID> /F /T`)
When killing a port, Super Port uses the `/T` (Tree) flag. This ensures that parent wrappers (such as `npm`, `pnpm`, `yarn`, `npx`, or shell processes) and all child worker threads holding sockets are killed cleanly, eliminating ghost zombie ports for good.

---

## 📄 License

MIT License. Designed and crafted for developers who value their time.
