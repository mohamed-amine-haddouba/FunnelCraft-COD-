(function () {
  'use strict';

  const STORAGE_TOKEN_KEY = 'codworth_sandbox_jwt';
  const STORAGE_OWNER_KEY = 'codworth_sandbox_owner';
  const STORAGE_RESET_NOTICE_KEY = 'codworth_sandbox_reset_notice';

  // DOM References
  const loginView = document.getElementById('login-view');
  const resetView = document.getElementById('reset-view');
  const cockpitView = document.getElementById('cockpit-view');
  const loginStep1 = document.getElementById('login-step-1');
  const loginStep2 = document.getElementById('login-step-2');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const loginTotpInput = document.getElementById('login-totp');
  const loginAlert = document.getElementById('login-alert');
  const loginInfo = document.getElementById('login-info');
  const loginStep1Btn = document.getElementById('login-step-1-btn');
  const loginStep2Btn = document.getElementById('login-step-2-btn');
  const loginBackStep1Btn = document.getElementById('login-back-step-1-btn');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const requestEmailOtpBtn = document.getElementById('request-email-otp-btn');
  const resetForm = document.getElementById('reset-form');
  const resetPasswordInput = document.getElementById('reset-password');
  const resetPasswordConfirmInput = document.getElementById('reset-password-confirm');
  const resetAlert = document.getElementById('reset-alert');
  const btnUpdatePassword = document.getElementById('btn-update-password');
  const logoutBtn = document.getElementById('logout-btn');
  const globalRefreshBtn = document.getElementById('global-refresh-btn');
  const sidebarOwnerEmail = document.getElementById('sidebar-owner-email');
  const currentTabTitle = document.getElementById('current-tab-title');
  const cockpitSidebar = document.getElementById('cockpit-sidebar');
  const cockpitSidebarBackdrop = document.getElementById('cockpit-sidebar-backdrop');
  const cockpitMobileMenuBtn = document.getElementById('cockpit-mobile-menu-btn');
  const cockpitSidebarCloseBtn = document.getElementById('cockpit-sidebar-close-btn');

  // Topbar & Deploy References
  const topGitBranch = document.getElementById('top-git-branch');
  const topGitCommit = document.getElementById('top-git-commit');
  const deployServiceDot = document.getElementById('deploy-service-dot');
  const deployServiceStatus = document.getElementById('deploy-service-status');
  const deployServiceMeta = document.getElementById('deploy-service-meta');
  const deployRamValue = document.getElementById('deploy-ram-value');
  const deployRamBar = document.getElementById('deploy-ram-bar');
  const deployRamSub = document.getElementById('deploy-ram-sub');
  const deployUptimeValue = document.getElementById('deploy-uptime-value');
  const deployHostSub = document.getElementById('deploy-host-sub');
  const btnGitPull = document.getElementById('btn-git-pull');
  const btnRunDeploy = document.getElementById('btn-run-deploy');
  const deployBtnSpinner = document.getElementById('deploy-btn-spinner');
  const deployBtnIcon = document.getElementById('deploy-btn-icon');
  const deployBtnLabel = document.getElementById('deploy-btn-label');
  const btnClearDeployLog = document.getElementById('btn-clear-deploy-log');
  const deployStreamStatus = document.getElementById('deploy-stream-status');
  const deployTerminalOutput = document.getElementById('deploy-terminal-output');

  // Logs References
  const logsAppSelect = document.getElementById('logs-app-select');
  const btnRefreshLogs = document.getElementById('btn-refresh-logs');
  const logsMetaTitle = document.getElementById('logs-meta-title');
  const pm2LogsOutput = document.getElementById('pm2-logs-output');

  // System & App Analytics References
  const sysAppMerchants = document.getElementById('sys-app-merchants');
  const sysAppMerchantsSub = document.getElementById('sys-app-merchants-sub');
  const sysAppPages = document.getElementById('sys-app-pages');
  const sysAppPagesSub = document.getElementById('sys-app-pages-sub');
  const sysAppOrdersToday = document.getElementById('sys-app-orders-today');
  const sysAppOrdersTotal = document.getElementById('sys-app-orders-total');
  const sysAppRevenue = document.getElementById('sys-app-revenue');
  const sysAppMrrSub = document.getElementById('sys-app-mrr-sub');
  const sysCpuLoad = document.getElementById('sys-cpu-load');
  const sysCpuBar = document.getElementById('sys-cpu-bar');
  const sysCpuSub = document.getElementById('sys-cpu-sub');
  const sysOsUptime = document.getElementById('sys-os-uptime');
  const sysOsPlatform = document.getElementById('sys-os-platform');
  const sysNodeRss = document.getElementById('sys-node-rss');
  const sysNodeHeap = document.getElementById('sys-node-heap');
  const sysNginxDot = document.getElementById('sys-nginx-dot');
  const sysNginxStatus = document.getElementById('sys-nginx-status');
  const sysNginxSub = document.getElementById('sys-nginx-sub');
  const sysDiskPct = document.getElementById('sys-disk-pct');
  const sysDiskBar = document.getElementById('sys-disk-bar');
  const sysDiskSummary = document.getElementById('sys-disk-summary');
  const sysMemPct = document.getElementById('sys-mem-pct');
  const sysMemBar = document.getElementById('sys-mem-bar');
  const sysMemSummary = document.getElementById('sys-mem-summary');
  const sysPm2Tbody = document.getElementById('sys-pm2-tbody');
  const sysDfRaw = document.getElementById('sys-df-raw');
  const sysFreeRaw = document.getElementById('sys-free-raw');

  // Interactive Web Terminal References (xterm.js + node-pty)
  const xtermContainer = document.getElementById('xterm-container');
  const wsTerminalBadge = document.getElementById('ws-terminal-badge');
  const btnReconnectTerminal = document.getElementById('btn-reconnect-terminal');
  const safeTerminalForm = document.getElementById('safe-terminal-form');
  const safeTerminalInput = document.getElementById('safe-terminal-input');
  const btnClearSafeTerminal = document.getElementById('btn-clear-safe-terminal');

  // Security & Backups References
  const btnRefreshSecurity = document.getElementById('btn-refresh-security');
  const securityLoginsTbody = document.getElementById('security-logins-tbody');
  const btnDownloadBackup = document.getElementById('btn-download-backup');
  const backupFilesTbody = document.getElementById('backup-files-tbody');

  let activeDeployEventSource = null;
  let pendingLoginTicket = null;
  let otpCooldownInterval = null;
  let xtermInstance = null;
  let xtermFitAddon = null;
  let terminalSocket = null;

  function getJwt() {
    try {
      return sessionStorage.getItem(STORAGE_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  function setJwt(token, ownerEmail) {
    try {
      sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
      if (ownerEmail) {
        sessionStorage.setItem(STORAGE_OWNER_KEY, ownerEmail);
      }
    } catch {
      // ignore storage errors
    }
  }

  function clearJwt() {
    try {
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_OWNER_KEY);
    } catch {
      // ignore
    }
  }

  function showLoginError(msg) {
    loginInfo.classList.add('hidden');
    loginAlert.textContent = msg;
    loginAlert.classList.remove('hidden');
  }

  function showLoginInfo(msg) {
    loginAlert.classList.add('hidden');
    loginInfo.textContent = msg;
    loginInfo.classList.remove('hidden');
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  }

  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  }

  function escapeHtml(str) {
    const raw = str === null || str === undefined ? '' : String(str);
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function apiFetch(endpoint, options) {
    const token = getJwt();
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      (options && options.headers) || {}
    );
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/sandbox${endpoint}`, Object.assign({}, options, { headers }));
    if (response.status === 401 || response.status === 403) {
      const errData = await response.json().catch(() => ({}));
      if (
        endpoint !== '/login' &&
        endpoint !== '/login/2fa' &&
        endpoint !== '/2fa/send' &&
        endpoint !== '/terminal'
      ) {
        clearJwt();
        switchView(false);
        showLoginError(errData.error || 'Session expired or unauthorized. Please sign in again.');
      }
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return response;
  }

  function showResetError(msg) {
    if (!resetAlert) return;
    resetAlert.textContent = msg;
    resetAlert.classList.remove('hidden');
  }

  function clearOtpCooldown() {
    if (otpCooldownInterval) {
      clearInterval(otpCooldownInterval);
      otpCooldownInterval = null;
    }
  }

  function startOtpCooldown() {
    if (!requestEmailOtpBtn) return;
    clearOtpCooldown();
    let remaining = 60;
    requestEmailOtpBtn.disabled = true;
    requestEmailOtpBtn.textContent = `Resend code in ${remaining}s...`;
    otpCooldownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearOtpCooldown();
        if (pendingLoginTicket) {
          requestEmailOtpBtn.disabled = false;
        }
        requestEmailOtpBtn.textContent = 'Resend Code';
      } else {
        requestEmailOtpBtn.textContent = `Resend code in ${remaining}s...`;
      }
    }, 1000);
  }

  function resetWizardToStep1() {
    pendingLoginTicket = null;
    clearOtpCooldown();
    if (loginPasswordInput) loginPasswordInput.value = '';
    if (loginTotpInput) loginTotpInput.value = '';
    if (requestEmailOtpBtn) {
      requestEmailOtpBtn.disabled = true;
      requestEmailOtpBtn.textContent = 'Resend Code';
    }
    if (loginStep2) loginStep2.classList.add('hidden');
    if (loginStep1) loginStep1.classList.remove('hidden');
  }

  function switchView(authenticated) {
    if (resetView) {
      resetView.classList.add('hidden');
    }
    if (authenticated) {
      loginView.classList.add('hidden');
      cockpitView.classList.remove('hidden');
      const savedOwner = sessionStorage.getItem(STORAGE_OWNER_KEY) || 'naadianajah2020@gmail.com';
      sidebarOwnerEmail.textContent = savedOwner;
    } else {
      cockpitView.classList.add('hidden');
      loginView.classList.remove('hidden');
      resetWizardToStep1();
    }
  }

  // Independent Multi-Page URL Routing (/sandbox/deploy, /sandbox/terminal, /sandbox/system, /sandbox/logs, /sandbox/security, /sandbox/backups)
  const VALID_TABS = ['deploy', 'terminal', 'system', 'logs', 'security', 'backups'];
  const TAB_TITLES = {
    deploy: 'Deployment Dashboard (/sandbox/deploy)',
    terminal: 'Interactive Web Terminal (/sandbox/terminal)',
    system: 'System Health & Analytics (/sandbox/system)',
    logs: 'PM2 Logs Viewer (/sandbox/logs)',
    security: 'Security Audit Trail (/sandbox/security)',
    backups: 'Data Backups (/sandbox/backups)',
  };

  function resolveTabFromPathname(pathname) {
    const clean = String(pathname || '').replace(/\/+$/, '');
    const match = clean.match(/^\/sandbox\/([a-z0-9_-]+)$/i);
    if (match && VALID_TABS.includes(match[1].toLowerCase())) {
      return match[1].toLowerCase();
    }
    return 'deploy';
  }

  function closeMobileSidebar() {
    if (cockpitSidebar) {
      cockpitSidebar.classList.remove('open');
    }
    if (cockpitSidebarBackdrop) {
      cockpitSidebarBackdrop.classList.add('hidden');
    }
    if (cockpitMobileMenuBtn) {
      cockpitMobileMenuBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function openMobileSidebar() {
    if (cockpitSidebar) {
      cockpitSidebar.classList.add('open');
    }
    if (cockpitSidebarBackdrop) {
      cockpitSidebarBackdrop.classList.remove('hidden');
    }
    if (cockpitMobileMenuBtn) {
      cockpitMobileMenuBtn.setAttribute('aria-expanded', 'true');
    }
  }

  if (cockpitMobileMenuBtn) {
    cockpitMobileMenuBtn.addEventListener('click', () => {
      if (cockpitSidebar && cockpitSidebar.classList.contains('open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }

  if (cockpitSidebarCloseBtn) {
    cockpitSidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  }

  if (cockpitSidebarBackdrop) {
    cockpitSidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  function activateRouteTab(targetTab, options) {
    const tab = VALID_TABS.includes(targetTab) ? targetTab : 'deploy';
    const opts = options || {};
    const targetPath = `/sandbox/${tab}`;

    if (opts.push && window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    } else if (opts.replace && window.location.pathname !== targetPath) {
      window.history.replaceState({ tab }, '', targetPath);
    }

    document.querySelectorAll('.nav-item').forEach((item) => {
      if (item.getAttribute('data-tab') === tab) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    closeMobileSidebar();

    document.querySelectorAll('.tab-panel').forEach((panel) => {
      if (panel.id === `tab-${tab}`) {
        panel.classList.remove('hidden');
        panel.classList.add('active');
      } else {
        panel.classList.add('hidden');
        panel.classList.remove('active');
      }
    });

    if (currentTabTitle) {
      currentTabTitle.textContent = TAB_TITLES[tab] || 'Sandbox Cockpit';
    }

    if (tab === 'terminal') {
      ensureInteractiveTerminal();
      setTimeout(() => {
        if (xtermFitAddon) {
          try {
            xtermFitAddon.fit();
          } catch {
            // ignore fit error when hidden
          }
        }
        if (xtermInstance) {
          xtermInstance.focus();
        }
      }, 60);
    } else if (tab === 'logs') {
      loadPm2Logs();
    } else if (tab === 'security' || tab === 'backups') {
      loadSecurityAndBackups();
    } else if (tab === 'system' || tab === 'deploy') {
      loadSystemStatus();
    }
  }

  document.querySelectorAll('.nav-item').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab') || 'deploy';
      activateRouteTab(targetTab, { push: true });
    });
  });

  window.addEventListener('popstate', () => {
    if (!cockpitView.classList.contains('hidden')) {
      const tab = resolveTabFromPathname(window.location.pathname);
      activateRouteTab(tab, { push: false });
    }
  });

  // Load System Status & Comprehensive Server + App Telemetry
  async function loadSystemStatus() {
    try {
      const res = await apiFetch('/status', { method: 'GET' });
      const data = await res.json();
      if (!data.ok) return;

      // Topbar Git info
      topGitBranch.textContent = (data.git && data.git.branch) || 'main';
      topGitCommit.textContent = (data.git && data.git.commit) || 'HEAD';

      // Service status card (Deploy tab)
      const isOnline = data.service && data.service.status === 'Online';
      deployServiceStatus.textContent = isOnline ? 'Online' : 'Offline';
      deployServiceStatus.className = `metric-value ${isOnline ? 'status-text-online' : 'status-text-offline'}`;
      deployServiceDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`;
      deployServiceMeta.textContent = `PID: ${data.service.pid || '—'} • Restarts: ${data.service.restarts || 0}`;

      // RAM usage card (Deploy tab)
      const usedMb = data.memory.usedMb || 0;
      const totalMb = data.memory.totalMb || 0;
      const memPct = data.memory.usagePercent || 0;
      deployRamValue.textContent = `${usedMb} MB / ${totalMb} MB (${memPct}%)`;
      deployRamBar.style.width = `${Math.min(100, memPct)}%`;
      deployRamSub.textContent = `Node Process RSS: ${data.service.processMemoryMb || 0} MB`;

      // Uptime card (Deploy tab)
      deployUptimeValue.textContent = formatDuration(data.service.uptimeSeconds);
      deployHostSub.textContent = `${data.system.hostname} • Node ${data.system.nodeVersion}`;

      // App Business Metrics (System Health tab)
      const app = data.appMetrics || {};
      if (sysAppMerchants) {
        sysAppMerchants.textContent = String(app.totalMerchants ?? 0);
      }
      if (sysAppMerchantsSub) {
        sysAppMerchantsSub.textContent = `Active merchants: ${app.activeMerchants ?? 0} • Total users: ${app.totalUsers ?? 0}`;
      }
      if (sysAppPages) {
        sysAppPages.textContent = String(app.totalActivePages ?? 0);
      }
      if (sysAppPagesSub) {
        sysAppPagesSub.textContent = `Total funnels in DB: ${app.totalPages ?? 0}`;
      }
      if (sysAppOrdersToday) {
        sysAppOrdersToday.textContent = String(app.codOrdersToday ?? 0);
      }
      if (sysAppOrdersTotal) {
        sysAppOrdersTotal.textContent = `All-time COD orders: ${app.totalOrders ?? 0}`;
      }
      if (sysAppRevenue) {
        const rev = Number(app.totalRevenueMad || 0).toLocaleString('en-US');
        sysAppRevenue.textContent = `${rev} MAD`;
      }
      if (sysAppMrrSub) {
        const mrr = Number(app.mrrMad || 0).toLocaleString('en-US');
        sysAppMrrSub.textContent = `Subscription MRR: ${mrr} MAD/mo`;
      }

      // Server Hardware & Runtime Metrics (System Health tab)
      const cpu = data.cpu || {};
      const loadArr = (data.system && data.system.loadAvg) || [0, 0, 0];
      const l1 = cpu.load1m !== undefined ? cpu.load1m : loadArr[0] || 0;
      const l5 = cpu.load5m !== undefined ? cpu.load5m : loadArr[1] || 0;
      const l15 = cpu.load15m !== undefined ? cpu.load15m : loadArr[2] || 0;
      const cpuPct = cpu.usagePercent !== undefined ? cpu.usagePercent : 0;
      const cores = cpu.cores || (data.system && data.system.cpuCount) || 1;

      if (sysCpuLoad) {
        sysCpuLoad.textContent = `${l1} / ${l5} / ${l15}`;
      }
      if (sysCpuBar) {
        sysCpuBar.style.width = `${Math.min(100, cpuPct)}%`;
      }
      if (sysCpuSub) {
        sysCpuSub.textContent = `${cores} vCPU Cores • Load: ${cpuPct}%`;
      }

      if (sysOsUptime && data.system) {
        sysOsUptime.textContent = formatDuration(data.system.systemUptimeSeconds);
      }
      if (sysOsPlatform && data.system) {
        sysOsPlatform.textContent = `API Uptime: ${formatDuration(data.service.uptimeSeconds)} • ${data.system.platform}`;
      }

      if (sysNodeRss && data.service) {
        sysNodeRss.textContent = `${data.service.processMemoryMb || 0} MB RSS`;
      }
      if (sysNodeHeap && data.service) {
        sysNodeHeap.textContent = `Heap Used: ${data.service.heapUsedMb || 0} MB / ${data.service.heapTotalMb || 0} MB`;
      }

      const nginxActive = data.nginx && data.nginx.active;
      sysNginxStatus.textContent = nginxActive ? 'Active' : 'Inactive';
      sysNginxStatus.className = `metric-value ${nginxActive ? 'status-text-online' : 'status-text-offline'}`;
      sysNginxDot.className = `status-dot ${nginxActive ? 'status-online' : 'status-offline'}`;
      sysNginxSub.textContent = (data.nginx && data.nginx.statusText) || 'Reverse Proxy';

      const diskPct = (data.disk && data.disk.usagePercent) || 0;
      sysDiskPct.textContent = `${diskPct}%`;
      sysDiskBar.style.width = `${Math.min(100, diskPct)}%`;
      sysDiskSummary.textContent = (data.disk && data.disk.summary) || '—';
      sysDfRaw.textContent = (data.disk && data.disk.rawDfH) || '';

      sysMemPct.textContent = `${memPct}%`;
      sysMemBar.style.width = `${Math.min(100, memPct)}%`;
      sysMemSummary.textContent = `${usedMb} MB used of ${totalMb} MB (${data.memory.freeMb} MB free)`;
      sysFreeRaw.textContent = (data.memory && data.memory.rawFreeM) || '';

      // PM2 Process Statuses Table
      if (sysPm2Tbody) {
        const procs = Array.isArray(data.pm2Processes) ? data.pm2Processes : [];
        if (procs.length === 0) {
          sysPm2Tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No PM2 processes reported.</td></tr>';
        } else {
          sysPm2Tbody.innerHTML = procs
            .map((p) => {
              const online = String(p.status).toLowerCase() === 'online';
              const badge = online ? 'badge-success' : 'badge-danger';
              return `<tr>
                <td><code>${escapeHtml(p.name)}</code></td>
                <td class="tabular-nums">${escapeHtml(p.pid)}</td>
                <td><span class="badge-status ${badge}">${escapeHtml(String(p.status).toUpperCase())}</span></td>
                <td class="tabular-nums">${escapeHtml(p.cpuPercent !== undefined ? p.cpuPercent : 0)}%</td>
                <td class="tabular-nums">${escapeHtml(p.memoryMb)} MB</td>
                <td class="tabular-nums">${escapeHtml(formatDuration(p.uptimeSec))}</td>
                <td class="tabular-nums">${escapeHtml(p.restarts)}</td>
              </tr>`;
            })
            .join('');
        }
      }
    } catch (err) {
      console.warn('[Cockpit] Failed to load status:', err);
    }
  }

  // Load PM2 Logs
  async function loadPm2Logs() {
    const appName = logsAppSelect.value || 'funnelcraft-api';
    logsMetaTitle.textContent = `PM2 LOGS: ${appName} (LAST 100 LINES)`;
    pm2LogsOutput.textContent = `Fetching last 100 lines for ${appName}...`;

    try {
      const res = await apiFetch(`/logs/${encodeURIComponent(appName)}`, { method: 'GET' });
      const data = await res.json();
      pm2LogsOutput.textContent = data.logs || 'No log output returned.';
      pm2LogsOutput.scrollTop = pm2LogsOutput.scrollHeight;
    } catch (err) {
      pm2LogsOutput.textContent = `[Error fetching logs] ${err.message}`;
    }
  }

  // Load Security Logins & Backup File Inventory
  async function loadSecurityAndBackups() {
    try {
      const res = await apiFetch('/security/logins', { method: 'GET' });
      const data = await res.json();
      if (!data.ok) return;

      const logins = Array.isArray(data.logins) ? data.logins : [];
      if (logins.length === 0) {
        securityLoginsTbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No login events recorded yet.</td></tr>';
      } else {
        securityLoginsTbody.innerHTML = logins
          .slice(0, 10)
          .map((item) => {
            const badgeClass =
              item.status === 'SUCCESS'
                ? 'badge-success'
                : item.status === 'OTP_SENT'
                ? 'badge-warn'
                : 'badge-danger';
            return `<tr>
              <td class="tabular-nums">${escapeHtml(item.timestamp)}</td>
              <td><span class="badge-status ${badgeClass}">${escapeHtml(item.status)}</span></td>
              <td class="tabular-nums">${escapeHtml(item.email)}</td>
              <td class="tabular-nums">${escapeHtml(item.ip)}</td>
              <td title="${escapeHtml(item.userAgent)}">${escapeHtml(String(item.userAgent || '').slice(0, 72))}</td>
            </tr>`;
          })
          .join('');
      }

      const files = Array.isArray(data.dataFiles) ? data.dataFiles : [];
      if (files.length === 0) {
        backupFilesTbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No files found in data/ directory.</td></tr>';
      } else {
        backupFilesTbody.innerHTML = files
          .map(
            (f) => `<tr>
              <td><code>data/${escapeHtml(f.name)}</code></td>
              <td class="tabular-nums">${escapeHtml(formatBytes(f.sizeBytes))}</td>
              <td class="tabular-nums">${escapeHtml(f.updatedAt)}</td>
            </tr>`
          )
          .join('');
      }
    } catch (err) {
      console.warn('[Cockpit] Failed to load security logins:', err);
    }
  }

  // Initial state: Ensure "Send Email 2FA Code" button is strictly disabled on load
  if (requestEmailOtpBtn) {
    requestEmailOtpBtn.disabled = true;
  }

  // Step 1 Submit: Verify Email + Password -> Transition to Step 2 (loginTicket)
  if (loginStep1) {
    loginStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginAlert.classList.add('hidden');
      loginInfo.classList.add('hidden');
      if (loginStep1Btn) loginStep1Btn.disabled = true;

      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;

      try {
        const response = await fetch('/api/sandbox/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 403) {
          showLoginError(data.error || 'Access Denied (403): Only naadianajah2020@gmail.com is allowed.');
          return;
        }

        if (!response.ok) {
          showLoginError(data.error || 'Authentication failed. Check your credentials.');
          return;
        }

        // Immediately clear plaintext password after Step 1 verification succeeds
        loginPasswordInput.value = '';

        if (data.requires2FA && data.loginTicket) {
          pendingLoginTicket = data.loginTicket;
          loginStep1.classList.add('hidden');
          loginStep2.classList.remove('hidden');
          loginTotpInput.value = '';
          startOtpCooldown();
          showLoginInfo('Password verified. A 6-digit code has been automatically sent to your email.');
          loginTotpInput.focus();

          try {
            const otpRes = await fetch('/api/sandbox/2fa/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ loginTicket: pendingLoginTicket }),
            });
            const otpData = await otpRes.json().catch(() => ({}));
            if (!otpRes.ok) {
              if (otpData.code === 'INVALID_LOGIN_TICKET') {
                resetWizardToStep1();
              }
              showLoginError(otpData.error || 'Failed to automatically send 2FA code.');
            }
          } catch (otpErr) {
            showLoginError(`Network error sending 2FA code: ${otpErr.message}`);
          }
          return;
        }

        if (data.ok && data.token) {
          pendingLoginTicket = null;
          setJwt(data.token, data.owner && data.owner.email);
          switchView(true);
          const initialTab = resolveTabFromPathname(window.location.pathname);
          activateRouteTab(initialTab, { replace: true });
          await Promise.all([loadSystemStatus(), loadSecurityAndBackups()]);
        }
      } catch (err) {
        showLoginError(`Network error: ${err.message}`);
      } finally {
        if (loginStep1Btn) loginStep1Btn.disabled = false;
      }
    });
  }

  // Step 2 Submit: Verify loginTicket + 6-digit totpCode -> Enter Cockpit
  if (loginStep2) {
    loginStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginAlert.classList.add('hidden');
      loginInfo.classList.add('hidden');

      const totpCode = loginTotpInput.value.trim();
      if (!pendingLoginTicket) {
        resetWizardToStep1();
        showLoginError('Your 2FA session ticket expired or is missing. Please enter your credentials again.');
        return;
      }

      if (loginStep2Btn) loginStep2Btn.disabled = true;

      try {
        const response = await fetch('/api/sandbox/login/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: pendingLoginTicket, totpCode }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (data.code === 'INVALID_LOGIN_TICKET') {
            resetWizardToStep1();
          }
          showLoginError(data.error || 'Invalid or expired 6-digit 2FA code.');
          return;
        }

        if (data.ok && data.token) {
          pendingLoginTicket = null;
          loginTotpInput.value = '';
          setJwt(data.token, data.owner && data.owner.email);
          switchView(true);
          const initialTab = resolveTabFromPathname(window.location.pathname);
          activateRouteTab(initialTab, { replace: true });
          await Promise.all([loadSystemStatus(), loadSecurityAndBackups()]);
        }
      } catch (err) {
        showLoginError(`Network error: ${err.message}`);
      } finally {
        if (loginStep2Btn) loginStep2Btn.disabled = false;
      }
    });
  }

  // Step 2 Back to Step 1 Button
  if (loginBackStep1Btn) {
    loginBackStep1Btn.addEventListener('click', () => {
      loginAlert.classList.add('hidden');
      loginInfo.classList.add('hidden');
      resetWizardToStep1();
    });
  }

  // Request Email 2FA OTP (Step 2 Resend Button) - Gated behind pendingLoginTicket & 60s cooldown
  if (requestEmailOtpBtn) {
    requestEmailOtpBtn.addEventListener('click', async () => {
      if (!pendingLoginTicket) {
        resetWizardToStep1();
        showLoginError('Please verify your email and password in Step 1 first.');
        return;
      }

      startOtpCooldown();
      try {
        const res = await fetch('/api/sandbox/2fa/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginTicket: pendingLoginTicket }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.code === 'INVALID_LOGIN_TICKET') {
            resetWizardToStep1();
          }
          showLoginError(data.error || 'Failed to request 2FA code.');
        } else {
          showLoginInfo('A new 6-digit code has been sent to your email.');
        }
      } catch (err) {
        showLoginError(err.message);
      }
    });
  }

  // Forgot Password Trigger
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
      const email = loginEmailInput.value.trim();
      if (!email) {
        showLoginError('Enter your Owner email address first.');
        return;
      }

      forgotPasswordBtn.disabled = true;
      const originalLabel = forgotPasswordBtn.textContent;
      forgotPasswordBtn.textContent = 'Sending...';
      loginAlert.classList.add('hidden');
      loginInfo.classList.add('hidden');

      try {
        const res = await fetch('/api/sandbox/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showLoginError(data.error || 'Failed to send password reset email.');
        } else {
          showLoginInfo(data.message || 'Password reset link sent to your email.');
        }
      } catch (err) {
        showLoginError(`Network error: ${err.message}`);
      } finally {
        forgotPasswordBtn.disabled = false;
        forgotPasswordBtn.textContent = originalLabel;
      }
    });
  }

  // Reset Password Form Submission (Standalone Isolated Reset View)
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (resetAlert) {
        resetAlert.classList.add('hidden');
      }

      const newPassword = resetPasswordInput.value;
      const confirmPassword = resetPasswordConfirmInput.value;

      if (newPassword !== confirmPassword) {
        showResetError('Passwords do not match.');
        return;
      }

      if (newPassword.length < 8) {
        showResetError('Password must be at least 8 characters long.');
        return;
      }

      const token = new URLSearchParams(window.location.search).get('reset_token') || '';
      if (!token) {
        showResetError('Missing password reset token.');
        return;
      }

      btnUpdatePassword.disabled = true;
      btnUpdatePassword.textContent = 'Updating...';

      try {
        const res = await fetch('/api/sandbox/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showResetError(data.error || 'Failed to update password.');
          return;
        }

        resetForm.reset();
        try {
          sessionStorage.setItem(
            STORAGE_RESET_NOTICE_KEY,
            data.message || 'Password updated successfully! Please login.'
          );
        } catch {
          // ignore storage errors
        }
        window.history.replaceState({}, document.title, '/sandbox/');
        window.location.href = '/sandbox/';
      } catch (err) {
        showResetError(`Network error: ${err.message}`);
      } finally {
        btnUpdatePassword.disabled = false;
        btnUpdatePassword.textContent = 'Update Password';
      }
    });
  }

  // Logout
  logoutBtn.addEventListener('click', () => {
    if (activeDeployEventSource) {
      activeDeployEventSource.close();
      activeDeployEventSource = null;
    }
    if (terminalSocket) {
      try {
        terminalSocket.close();
      } catch {
        // ignore
      }
      terminalSocket = null;
    }
    fetch('/api/sandbox/logout', { method: 'POST' }).catch(() => {});
    clearJwt();
    switchView(false);
  });

  // Global Refresh
  globalRefreshBtn.addEventListener('click', () => {
    loadSystemStatus();
    loadSecurityAndBackups();
  });

  // Git Pull Button
  btnGitPull.addEventListener('click', async () => {
    btnGitPull.disabled = true;
    deployStreamStatus.textContent = 'EXECUTING: git pull origin main...';
    deployTerminalOutput.textContent += `\n$ git pull origin main\n`;

    try {
      const res = await apiFetch('/git-pull', { method: 'POST' });
      const data = await res.json();
      if (data.stdout) deployTerminalOutput.textContent += data.stdout;
      if (data.stderr) deployTerminalOutput.textContent += data.stderr;
      deployTerminalOutput.textContent += `\n[exit code: ${data.exitCode} | ${data.durationMs}ms]\n`;
      deployStreamStatus.textContent = data.ok
        ? 'GIT PULL COMPLETED SUCCESSFULLY'
        : `GIT PULL FINISHED WITH CODE ${data.exitCode}`;
      deployTerminalOutput.scrollTop = deployTerminalOutput.scrollHeight;
      loadSystemStatus();
    } catch (err) {
      deployTerminalOutput.textContent += `\n[Error] ${err.message}\n`;
      deployStreamStatus.textContent = 'GIT PULL FAILED';
    } finally {
      btnGitPull.disabled = false;
    }
  });

  function resetDeployStepsUI() {
    for (let i = 1; i <= 5; i += 1) {
      const card = document.querySelector(`.deploy-step-card[data-step="${i}"]`);
      const badge = document.getElementById(`deploy-step-icon-${i}`);
      if (card) {
        card.classList.remove('step-running', 'step-success', 'step-error');
      }
      if (badge) {
        badge.textContent = 'Pending';
      }
    }
  }

  function updateDeployStepUI(stepNum, status) {
    const card = document.querySelector(`.deploy-step-card[data-step="${stepNum}"]`);
    const badge = document.getElementById(`deploy-step-icon-${stepNum}`);
    if (!card || !badge) return;
    card.classList.remove('step-running', 'step-success', 'step-error');
    if (status === 'running') {
      card.classList.add('step-running');
      badge.innerHTML = '<span class="btn-spinner"></span> Running';
    } else if (status === 'success') {
      card.classList.add('step-success');
      badge.textContent = '✓ Passed';
    } else if (status === 'error') {
      card.classList.add('step-error');
      badge.textContent = '✕ Failed';
    } else {
      badge.textContent = 'Pending';
    }
  }

  function setDeployButtonRunning(running) {
    if (!btnRunDeploy) return;
    btnRunDeploy.disabled = running;
    if (deployBtnSpinner) {
      deployBtnSpinner.classList.toggle('hidden', !running);
    }
    if (deployBtnIcon) {
      deployBtnIcon.classList.toggle('hidden', running);
    }
    if (deployBtnLabel) {
      deployBtnLabel.textContent = running ? 'Deploying Pipeline...' : 'Run Checks & Deploy';
    }
  }

  // Run Checks & Deploy (Real-Time 5-Step SSE Stream)
  btnRunDeploy.addEventListener('click', () => {
    const token = getJwt();
    if (!token) {
      switchView(false);
      return;
    }

    if (activeDeployEventSource) {
      activeDeployEventSource.close();
      activeDeployEventSource = null;
    }

    resetDeployStepsUI();
    setDeployButtonRunning(true);
    deployTerminalOutput.textContent = '';
    deployStreamStatus.textContent =
      'STREAMING 5-STEP PIPELINE (git pull → npm install → tsc → build → pm2 restart)...';

    const streamUrl = `/api/sandbox/deploy/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(streamUrl);
    activeDeployEventSource = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'step' && payload.step) {
          updateDeployStepUI(payload.step, payload.status || 'running');
        }
        if (payload.message) {
          deployTerminalOutput.textContent += payload.message;
          deployTerminalOutput.scrollTop = deployTerminalOutput.scrollHeight;
        }
        if (payload.type === 'done') {
          deployStreamStatus.textContent = 'DEPLOYMENT PIPELINE SUCCEEDED ✓';
          setDeployButtonRunning(false);
          es.close();
          activeDeployEventSource = null;
          loadSystemStatus();
        } else if (payload.type === 'error') {
          if (payload.step) {
            updateDeployStepUI(payload.step, 'error');
          }
          deployStreamStatus.textContent = 'DEPLOYMENT PIPELINE FAILED ✕';
          setDeployButtonRunning(false);
          es.close();
          activeDeployEventSource = null;
        }
      } catch {
        deployTerminalOutput.textContent += `${event.data}\n`;
      }
    };

    es.onerror = () => {
      setDeployButtonRunning(false);
      es.close();
      activeDeployEventSource = null;
    };
  });

  btnClearDeployLog.addEventListener('click', () => {
    deployTerminalOutput.textContent = '[Output cleared]\n';
    resetDeployStepsUI();
  });

  // PM2 Logs Controls
  logsAppSelect.addEventListener('change', loadPm2Logs);
  btnRefreshLogs.addEventListener('click', loadPm2Logs);

  // Real Interactive Web Terminal (xterm.js + FitAddon + WebSocket PTY)
  function setTerminalBadge(state, label) {
    if (!wsTerminalBadge) return;
    wsTerminalBadge.classList.remove('badge-success', 'badge-warn', 'badge-danger');
    if (state === 'connected') {
      wsTerminalBadge.classList.add('badge-success');
    } else if (state === 'error') {
      wsTerminalBadge.classList.add('badge-danger');
    } else {
      wsTerminalBadge.classList.add('badge-warn');
    }
    wsTerminalBadge.textContent = label;
  }

  function connectTerminalWebSocket() {
    const token = getJwt();
    if (!token || !xtermInstance) return;

    if (terminalSocket) {
      try {
        terminalSocket.close();
      } catch {
        // ignore
      }
      terminalSocket = null;
    }

    setTerminalBadge('connecting', 'CONNECTING...');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/sandbox/terminal?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    terminalSocket = ws;

    ws.onopen = () => {
      setTerminalBadge('connected', 'CONNECTED (PTY)');
      if (xtermFitAddon) {
        try {
          xtermFitAddon.fit();
          ws.send(
            JSON.stringify({
              type: 'resize',
              cols: xtermInstance.cols || 100,
              rows: xtermInstance.rows || 28,
            })
          );
        } catch {
          // ignore fit error
        }
      }
    };

    ws.onmessage = (event) => {
      if (xtermInstance && typeof event.data === 'string') {
        xtermInstance.write(event.data);
      }
    };

    ws.onclose = () => {
      setTerminalBadge('error', 'DISCONNECTED');
    };

    ws.onerror = () => {
      setTerminalBadge('error', 'WS ERROR');
    };
  }

  function ensureInteractiveTerminal() {
    if (!xtermContainer) return;

    if (!xtermInstance && window.Terminal) {
      xtermInstance = new window.Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.35,
        scrollback: 3000,
        theme: {
          background: '#080C14',
          foreground: '#E2E8F0',
          cursor: '#10B981',
          selectionBackground: 'rgba(226, 91, 38, 0.35)',
        },
      });

      if (window.FitAddon && window.FitAddon.FitAddon) {
        xtermFitAddon = new window.FitAddon.FitAddon();
        xtermInstance.loadAddon(xtermFitAddon);
      }

      xtermInstance.open(xtermContainer);
      if (xtermFitAddon) {
        try {
          xtermFitAddon.fit();
        } catch {
          // ignore
        }
      }

      xtermInstance.onData((data) => {
        if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
          terminalSocket.send(JSON.stringify({ type: 'input', data }));
        }
      });

      window.addEventListener('resize', () => {
        if (!xtermFitAddon || !xtermInstance) return;
        try {
          xtermFitAddon.fit();
          if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
            terminalSocket.send(
              JSON.stringify({
                type: 'resize',
                cols: xtermInstance.cols,
                rows: xtermInstance.rows,
              })
            );
          }
        } catch {
          // ignore
        }
      });
    }

    if (!terminalSocket || terminalSocket.readyState > WebSocket.OPEN) {
      connectTerminalWebSocket();
    }
  }

  function sendTerminalCommandLine(cmdString) {
    const clean = String(cmdString || '').trim();
    if (!clean) return;
    ensureInteractiveTerminal();
    if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: 'input', data: `${clean}\n` }));
    } else {
      setTimeout(() => {
        if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
          terminalSocket.send(JSON.stringify({ type: 'input', data: `${clean}\n` }));
        }
      }, 350);
    }
  }

  if (safeTerminalForm) {
    safeTerminalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!safeTerminalInput) return;
      sendTerminalCommandLine(safeTerminalInput.value);
      safeTerminalInput.value = '';
    });
  }

  document.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-cmd');
      sendTerminalCommandLine(cmd);
    });
  });

  if (btnReconnectTerminal) {
    btnReconnectTerminal.addEventListener('click', () => {
      ensureInteractiveTerminal();
      connectTerminalWebSocket();
    });
  }

  if (btnClearSafeTerminal) {
    btnClearSafeTerminal.addEventListener('click', () => {
      if (xtermInstance) {
        xtermInstance.clear();
      }
    });
  }

  // Security Refresh
  btnRefreshSecurity.addEventListener('click', loadSecurityAndBackups);

  // One-Click Data Backup (.tar.gz)
  btnDownloadBackup.addEventListener('click', async () => {
    const token = getJwt();
    if (!token) {
      switchView(false);
      return;
    }

    btnDownloadBackup.disabled = true;
    try {
      const res = await fetch('/api/sandbox/backup', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Backup failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `codworth-data-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Backup Error]', err);
    } finally {
      btnDownloadBackup.disabled = false;
    }
  });

  // Initial Session Check on Boot
  (async function init() {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset_token');
    if (resetToken && resetToken.trim() !== '') {
      if (loginView) loginView.classList.add('hidden');
      if (cockpitView) cockpitView.classList.add('hidden');
      if (resetView) resetView.classList.remove('hidden');
      return;
    }

    if (resetView) resetView.classList.add('hidden');

    try {
      const resetNotice = sessionStorage.getItem(STORAGE_RESET_NOTICE_KEY);
      if (resetNotice) {
        sessionStorage.removeItem(STORAGE_RESET_NOTICE_KEY);
        showLoginInfo(resetNotice);
      }
    } catch {
      // ignore storage errors
    }

    const existingToken = getJwt();
    if (!existingToken) {
      switchView(false);
      return;
    }

    try {
      const res = await fetch('/api/sandbox/status', {
        headers: { Authorization: `Bearer ${existingToken}` },
      });
      if (res.ok) {
        switchView(true);
        const initialTab = resolveTabFromPathname(window.location.pathname);
        activateRouteTab(initialTab, { replace: true });
        await Promise.all([loadSystemStatus(), loadSecurityAndBackups()]);
      } else {
        clearJwt();
        switchView(false);
      }
    } catch {
      switchView(false);
    }
  })();
})();
