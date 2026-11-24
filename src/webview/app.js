// Super Port Webview Client Application
(function () {
  let vscode;
  try {
    // VS Code Webview API
    vscode = acquireVsCodeApi();
  } catch (e) {
    // Fallback mock when running in standard browser/tray companion
    vscode = {
      postMessage: function (msg) {
        if (window.__superPortBackend) {
          window.__superPortBackend.onMessage(msg);
        } else {
          console.log('[Super Port Mock]', msg);
        }
      }
    };
  }

  // State
  let allPorts = [];
  let currentFilter = 'dev';
  let searchQuery = '';
  let activeModalPort = null;

  // DOM Elements
  const portsList = document.getElementById('portsList');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnKillAllDev = document.getElementById('btnKillAllDev');
  const selectRefresh = document.getElementById('selectRefresh');
  const filterPills = document.querySelectorAll('.filter-pill');

  // Metrics Elements
  const valDevServers = document.getElementById('valDevServers');
  const valDevRam = document.getElementById('valDevRam');
  const valConnections = document.getElementById('valConnections');
  const valTotalPorts = document.getElementById('valTotalPorts');

  // Traffic Modal Elements
  const trafficModal = document.getElementById('trafficModal');
  const modalPortTitle = document.getElementById('modalPortTitle');
  const modalProcess = document.getElementById('modalProcess');
  const modalTotalConns = document.getElementById('modalTotalConns');
  const modalEstablished = document.getElementById('modalEstablished');
  const modalUniqueClients = document.getElementById('modalUniqueClients');
  const connectionsTableBody = document.getElementById('connectionsTableBody');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalKill = document.getElementById('btnModalKill');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // Initialize
  initEventListeners();

  // Listen to messages from extension host
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'portsUpdate':
        allPorts = message.ports || [];
        updateMetrics(allPorts);
        renderPorts();
        break;
      case 'trafficUpdate':
        renderTrafficModal(message.traffic);
        break;
      case 'toast':
        showToast(message.message, message.severity || 'info');
        break;
      case 'error':
        showToast(message.message, 'error');
        break;
    }
  });

  function initEventListeners() {
    // Refresh button
    btnRefresh.addEventListener('click', () => {
      const icon = btnRefresh.querySelector('.refresh-icon');
      if (icon) {
        icon.classList.add('refresh-spin');
        setTimeout(() => icon.classList.remove('refresh-spin'), 600);
      }
      vscode.postMessage({ command: 'refresh' });
    });

    // Kill All Dev Ports
    btnKillAllDev.addEventListener('click', () => {
      vscode.postMessage({ command: 'killAllDev' });
    });

    // Search input
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase().trim();
      btnClearSearch.classList.toggle('hidden', searchQuery.length === 0);
      renderPorts();
    });

    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      btnClearSearch.classList.add('hidden');
      renderPorts();
    });

    // Filter pills
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter');
        renderPorts();
      });
    });

    // Auto-refresh select
    selectRefresh.addEventListener('change', e => {
      const val = parseInt(e.target.value, 10);
      vscode.postMessage({
        command: 'setAutoRefresh',
        enabled: val > 0,
        interval: val
      });
    });

    // Modal close
    btnCloseModal.addEventListener('click', closeModal);
    btnModalClose.addEventListener('click', closeModal);
    trafficModal.addEventListener('click', e => {
      if (e.target === trafficModal) closeModal();
    });

    // Modal Kill
    btnModalKill.addEventListener('click', () => {
      if (activeModalPort) {
        vscode.postMessage({
          command: 'kill',
          port: activeModalPort.port,
          pid: activeModalPort.pid,
          processName: activeModalPort.processName
        });
        closeModal();
      }
    });
  }

  function updateMetrics(ports) {
    const devPorts = ports.filter(p => p.isDevServer);
    valDevServers.textContent = devPorts.length.toString();

    const totalRamBytes = devPorts.reduce((acc, p) => acc + (p.memoryBytes || 0), 0);
    valDevRam.textContent = formatBytes(totalRamBytes);

    const totalConnections = ports.reduce((acc, p) => acc + (p.activeConnectionsCount || 0), 0);
    valConnections.textContent = totalConnections.toString();

    valTotalPorts.textContent = ports.length.toString();
  }

  function filterPortsList(ports) {
    return ports.filter(p => {
      // Category filter
      if (currentFilter === 'dev' && !p.isDevServer) return false;
      if (currentFilter === 'database' && p.framework.category !== 'database') return false;
      if (currentFilter === 'docker' && p.framework.category !== 'docker') return false;

      // Text search
      if (searchQuery) {
        const query = searchQuery;
        const portStr = p.port.toString();
        const frameworkName = (p.framework.name || '').toLowerCase();
        const procName = (p.processName || '').toLowerCase();
        const pidStr = (p.pid || '').toString();
        const cmd = (p.commandLine || '').toLowerCase();

        return (
          portStr.includes(query) ||
          frameworkName.includes(query) ||
          procName.includes(query) ||
          pidStr.includes(query) ||
          cmd.includes(query)
        );
      }

      return true;
    });
  }

  function renderPorts() {
    const filtered = filterPortsList(allPorts);

    if (filtered.length === 0) {
      portsList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    portsList.innerHTML = filtered.map(p => createPortCardHtml(p)).join('');

    // Attach card action listeners
    attachCardListeners();
  }

  function createPortCardHtml(p) {
    const isDev = p.isDevServer;
    const catClass = isDev
      ? 'is-dev'
      : p.framework.category === 'database'
      ? 'is-database'
      : p.framework.category === 'docker'
      ? 'is-docker'
      : '';

    const badgeStyle = `background-color: ${p.framework.badgeColor}20; color: ${p.framework.badgeColor}; border-color: ${p.framework.badgeColor}40;`;

    return `
      <div class="port-card ${catClass}" data-port="${p.port}" data-pid="${p.pid}" data-proc="${escapeHtml(p.processName)}">
        <div class="card-top">
          <div class="port-identifier">
            <span class="port-badge">:${p.port}</span>
            <span class="framework-badge" style="${badgeStyle}">
              <span>${p.framework.icon}</span> ${escapeHtml(p.framework.name)}
            </span>
          </div>
          <div class="pulse-indicator">
            <span class="pulse-dot"></span>
            <span>${p.activeConnectionsCount} conns</span>
          </div>
        </div>

        <div class="card-details">
          <div class="detail-row">
            <span class="detail-label">Process:</span>
            <span class="detail-val" title="${escapeHtml(p.processName)} (PID ${p.pid})">
              ${escapeHtml(p.processName)} <span style="color: var(--text-muted);">(PID ${p.pid})</span>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Memory:</span>
            <span class="detail-val">${escapeHtml(p.memoryFormatted)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Local URL:</span>
            <a class="url-link" data-url="${escapeHtml(p.url)}" title="Click to open or copy">
              ${escapeHtml(p.url)} 📋
            </a>
          </div>
          ${p.commandLine ? `
          <div class="detail-row">
            <span class="detail-label">Command:</span>
            <span class="detail-val" title="${escapeHtml(p.commandLine)}">
              ${escapeHtml(p.commandLine.substring(0, 45))}${p.commandLine.length > 45 ? '...' : ''}
            </span>
          </div>
          ` : ''}
        </div>

        <div class="card-actions">
          <button class="btn btn-action-kill action-kill" title="1-Click Kill process and its child tree">
            <span class="icon">⚡</span> Kill
          </button>
          <button class="btn btn-action-restart action-restart" title="Kill process & prepare restart">
            <span class="icon">🔄</span> Restart
          </button>
          <button class="btn btn-action-inspect action-inspect" title="Inspect incoming/outgoing connections">
            <span class="icon">🔍</span> Inspect
          </button>
          <button class="btn btn-action-link action-open" title="Open in default browser">
            <span class="icon">🌐</span> Open
          </button>
        </div>
      </div>
    `;
  }

  function attachCardListeners() {
    document.querySelectorAll('.port-card').forEach(card => {
      const port = parseInt(card.getAttribute('data-port'), 10);
      const pid = parseInt(card.getAttribute('data-pid'), 10);
      const processName = card.getAttribute('data-proc');
      const portObj = allPorts.find(p => p.port === port);

      // Kill button
      card.querySelector('.action-kill').addEventListener('click', () => {
        vscode.postMessage({
          command: 'kill',
          port,
          pid,
          processName
        });
      });

      // Restart button
      card.querySelector('.action-restart').addEventListener('click', () => {
        vscode.postMessage({
          command: 'restart',
          port
        });
      });

      // Inspect Traffic button
      card.querySelector('.action-inspect').addEventListener('click', () => {
        activeModalPort = portObj || { port, pid, processName };
        vscode.postMessage({
          command: 'inspectTraffic',
          port
        });
      });

      // Open button
      card.querySelector('.action-open').addEventListener('click', () => {
        if (portObj?.url) {
          vscode.postMessage({
            command: 'openBrowser',
            url: portObj.url
          });
        }
      });

      // URL copy
      const urlLink = card.querySelector('.url-link');
      if (urlLink) {
        urlLink.addEventListener('click', () => {
          if (portObj?.url) {
            vscode.postMessage({
              command: 'copyUrl',
              url: portObj.url
            });
          }
        });
      }
    });
  }

  function renderTrafficModal(traffic) {
    if (!traffic) return;

    modalPortTitle.textContent = `Traffic Inspector: :${traffic.port} (${traffic.frameworkName})`;
    modalProcess.textContent = `${traffic.processName} (PID ${traffic.listeningPid})`;
    modalTotalConns.textContent = traffic.totalConnections.toString();
    modalEstablished.textContent = traffic.establishedCount.toString();
    modalUniqueClients.textContent = traffic.uniqueRemoteIps.length.toString();

    if (traffic.connections.length === 0) {
      connectionsTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No active client connections right now. Dev server is waiting for requests.
          </td>
        </tr>
      `;
    } else {
      connectionsTableBody.innerHTML = traffic.connections.map(c => `
        <tr>
          <td><span class="badge state-${c.state.toLowerCase()}">${escapeHtml(c.state)}</span></td>
          <td>${escapeHtml(c.localAddress)}:${c.localPort}</td>
          <td>${escapeHtml(c.remoteAddress)}:${c.remotePort}</td>
          <td>${c.pid}</td>
        </tr>
      `).join('');
    }

    trafficModal.classList.remove('hidden');
  }

  function closeModal() {
    trafficModal.classList.add('hidden');
    activeModalPort = null;
  }

  function showToast(message, severity) {
    const toast = document.createElement('div');
    toast.className = `toast ${severity}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
