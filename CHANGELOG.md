# Changelog

All notable changes to the Super Port project will be documented in this file.

## [1.0.0] - Initial Release

### Added
- **Windows Port Inspection Engine**: Fast netstat and cached WMI/CIM pipeline scanning active listening sockets in < 35ms.
- **Process Tree Terminator**: 1-click `taskkill /PID <PID> /F /T` termination eliminating zombie parent and child dev server processes.
- **Dev Server Classifier**: Auto-detection for Vite, Next.js, Angular CLI, React, Vue, Nuxt, SvelteKit, Astro, Remix, Python (FastAPI/Flask/Django), Docker, Go, Rust, and Databases.
- **Live Traffic Inspector**: Real-time TCP connection state inspection (`ESTABLISHED`, `TIME_WAIT`, `CLOSE_WAIT`) and remote client IP tracking.
- **Terminal Collision Sentinel**: Automatic detection of `listen EADDRINUSE` errors with a 1-click kill notification prompt.
- **VS Code Extension Suite**:
  - Status Bar item displaying active dev server and memory usage.
  - Sidebar TreeView categorizing Dev Servers, Databases, and Ports with inline action buttons.
  - QuickPick menu (`Ctrl+Shift+P` -> `Super Port: Quick Kill...`).
  - Modern Cyberpunk Webview Dashboard with metrics, filters, and modals.
- **Standalone CLI & Companion**:
  - `super-port ls` (terminal table).
  - `super-port kill <port>` (1-click kill).
  - `super-port kill-all` (mass kill).
  - `super-port traffic <port>` (connection analytics).
  - `super-port ui` (standalone browser web dashboard).
