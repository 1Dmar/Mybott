/**
 * ProMcBot Dashboard shared shell.
 * The shell stays compact; server-specific navigation appears only after a managed server is selected.
 */
(function () {
  'use strict';

  const state = {
    user: null,
    currentGuildId: null,
    theme: localStorage.getItem('pmcbot_theme') || 'dark'
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const safeAvatarUrl = value => { try { const url = new URL(String(value || ''), window.location.origin); const allowedHosts = new Set(['cdn.discordapp.com', 'media.discordapp.net']); return url.protocol === 'https:' && allowedHosts.has(url.hostname.toLowerCase()) ? url.href : '/dashboard/logo.png'; } catch (_) { return '/dashboard/logo.png'; } };
  const serverPath = (guildId, page = 'overview') => `/myservers/${encodeURIComponent(guildId)}/${page}`;

  async function init() {
    initTheme();
    await checkAuth();
    extractGuildId();
    initSidebar();
    initDropdowns();
    setupEventListeners();
  }

  async function checkAuth() {
    const publicPaths = ['/', '/loading-auth', '/privacy', '/auth/discord', '/partners'];
    const isPublicProfile = /^\/(?:u|profile|user)\/[^/]+$/.test(window.location.pathname);
    const isPublicPage = publicPaths.includes(window.location.pathname) || isPublicProfile;
    try {
      const res = await fetch('/callback/check/userData');
      const data = await res.json();
      if (data.authenticated) {
        state.user = data.user;
        updateUserUI();
      } else if (!isPublicPage) {
        window.location.href = '/loading-auth';
      }
    } catch (_) {
      if (!isPublicPage) window.location.href = '/loading-auth';
    }
  }

  function updateUserUI() {
    const user = state.user || {};
    const displayName = user.global_name || user.username || 'User';
    const avatar = safeAvatarUrl(user.avatar);
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = displayName; });
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      el.src = avatar;
      el.onerror = () => { el.onerror = null; el.src = '/dashboard/logo.png'; };
    });
    document.querySelectorAll('[data-user-id]').forEach(el => { el.textContent = user.id || '—'; });
    document.querySelectorAll('[data-user-username]').forEach(el => { el.textContent = user.username || displayName; });
    document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = user.isAdmin !== true; });
  }

  function initTheme() {
    document.body.classList.toggle('dark', state.theme === 'dark');
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const icon = document.querySelector('#darkLight i') || document.querySelector('#darkLight');
    if (icon) icon.className = state.theme === 'dark' ? 'bx bx-sun' : 'bx bx-moon';
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pmcbot_theme', state.theme);
    document.body.classList.toggle('dark', state.theme === 'dark');
    updateThemeIcon();
  }

  function extractGuildId() {
    const match = window.location.pathname.match(/\/(?:servers|myservers)\/([^/]+)/);
    if (match) state.currentGuildId = match[1];
  }

  function selectedGuild() {
    return (state.user?.guilds || []).find(guild => String(guild.id) === String(state.currentGuildId) || String(guild.name || '').toLowerCase() === String(state.currentGuildId || '').toLowerCase()) || null;
  }

  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    let menuContent = sidebar.querySelector('.menu_content');
    if (!menuContent) {
      menuContent = document.createElement('div');
      menuContent.className = 'menu_content';
      const footer = sidebar.querySelector('.sidebar-footer');
      if (footer) sidebar.insertBefore(menuContent, footer);
      else sidebar.appendChild(menuContent);
    }

    const currentPath = window.location.pathname;
    const guild = selectedGuild();
    const gId = state.currentGuildId;
    const active = path => currentPath === path || currentPath.startsWith(`${path}/`);
    const serverName = guild?.name || (gId ? `Server ${gId}` : 'Choose a server');
    const serverIcon = guild?.icon ? `https://cdn.discordapp.com/icons/${encodeURIComponent(guild.id)}/${guild.icon}.png` : '/dashboard/logo.png';
    const navTag = (label, tone = 'new') => `<span class=\"nav-badge nav-badge-${tone}\" aria-label=\"${label} feature\">${label}</span>`;

    let html = '';
    if (gId) {
      html = `
        <a class="sidebar-server-context" href="/myservers" aria-label="Back to managed servers">
          <img src="${escapeHtml(serverIcon)}" alt="">
          <span><small>MANAGED SERVER</small><strong>${escapeHtml(serverName)}</strong></span>
          <i class="bx bx-chevron-right" aria-hidden="true"></i>
        </a>
        <ul class="menu_items">
          <div class="menu_title"><span>General</span></div>
          <li class="item"><a href="${serverPath(gId, 'overview')}" class="nav_link ${currentPath.endsWith('/overview') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-grid-alt"></i></span><span class="navlink">Overview</span></a></li>
          <li class="item"><a href="${serverPath(gId, 'settings')}" class="nav_link ${currentPath.endsWith('/settings') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-cog"></i></span><span class="navlink">Configuration</span></a></li>
        </ul>
        <ul class="menu_items">
          <div class="menu_title"><span>Features</span></div>
          <li class="item"><a href="${serverPath(gId, 'intelligence')}" class="nav_link ${currentPath.endsWith('/intelligence') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-pulse"></i></span><span class="navlink">Intelligence</span></a></li>
          <li class="item"><a href="${serverPath(gId, 'actions')}" class="nav_link ${currentPath.endsWith('/actions') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-check-shield"></i></span><span class="navlink">Action Center</span>${navTag('NEW')}</a></li>
          <li class="item"><a href="${serverPath(gId, 'smart-actions')}" class="nav_link ${currentPath.endsWith('/smart-actions') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-bolt-circle"></i></span><span class="navlink">Smart Actions</span>${navTag('NEW')}</a></li>
          <li class="item"><a href="${serverPath(gId, 'modules')}" class="nav_link ${currentPath.endsWith('/modules') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-extension"></i></span><span class="navlink">Modules</span></a></li>
          <li class="item"><a href="${serverPath(gId, 'moderation')}" class="nav_link ${currentPath.endsWith('/moderation') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-shield-quarter"></i></span><span class="navlink">Moderation</span>${navTag('PRO', 'pro')}</a></li>
          <li class="item"><a href="${serverPath(gId, 'logs')}" class="nav_link ${currentPath.endsWith('/logs') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-list-check"></i></span><span class="navlink">Audit</span></a></li>
        </ul>
        <ul class="menu_items">
          <div class="menu_title"><span>Others</span></div>
          <li class="item"><a href="/myservers" class="nav_link"><span class="navlink_icon"><i class="bx bx-arrow-back"></i></span><span class="navlink">Back to My Servers</span></a></li>
          <li class="item"><a href="${serverPath(gId, 'premium')}" class="nav_link ${currentPath.endsWith('/premium') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-crown"></i></span><span class="navlink">Premium</span></a></li>
        </ul>
      `;
    } else {
      html = `
        <ul class="menu_items">
          <div class="menu_title"><span>Workspace</span></div>
          <li class="item"><a href="/dashboard" class="nav_link ${active('/dashboard') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-home-alt-2"></i></span><span class="navlink">Account home</span></a></li>
          <li class="item"><a href="/myservers" class="nav_link ${active('/myservers') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-server"></i></span><span class="navlink">My servers</span></a></li>
        </ul>
      `;
    }
    menuContent.innerHTML = html;
    menuContent.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = state.user?.isAdmin !== true; });
  }

  function initSidebar() {
    buildSidebar();
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (!sidebar) return;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    sidebar.classList.toggle('close', mobile);
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }
    const closeMobileSidebar = () => { sidebar.classList.add('close'); backdrop.classList.remove('show'); };
    const toggleSidebar = () => { sidebar.classList.toggle('close'); backdrop.classList.toggle('show', !sidebar.classList.contains('close')); };
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    const closeButton = document.getElementById('sidebar-close');
    if (closeButton) closeButton.addEventListener('click', closeMobileSidebar);
    backdrop.addEventListener('click', closeMobileSidebar);
    sidebar.addEventListener('click', event => {
      if (event.target.closest('.nav_link, .sidebar-server-context') && window.matchMedia('(max-width: 768px)').matches) closeMobileSidebar();
    });
  }

  function initDropdowns() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const userBtn = document.getElementById('userBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (notificationBtn && notificationDropdown) notificationBtn.addEventListener('click', event => { event.stopPropagation(); notificationDropdown.classList.toggle('show'); if (userDropdown) userDropdown.classList.remove('show'); });
    if (userBtn && userDropdown) userBtn.addEventListener('click', event => { event.stopPropagation(); userDropdown.classList.toggle('show'); if (notificationDropdown) notificationDropdown.classList.remove('show'); });
    document.addEventListener('click', () => { if (notificationDropdown) notificationDropdown.classList.remove('show'); if (userDropdown) userDropdown.classList.remove('show'); });
  }

  function setupEventListeners() {
    const themeBtn = document.getElementById('darkLight');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    document.addEventListener('click', async event => {
      const logout = event.target.closest('a[href="/api/logout"]');
      if (!logout) return;
      event.preventDefault();
      logout.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (response.ok) window.location.assign('/');
        else throw new Error('Logout failed');
      } catch (_) {
        logout.removeAttribute('aria-busy');
        window.showToast('Logout could not be completed. Please try again.', 'error');
      }
    });
  }

  window.showToast = function (message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };
  window.copyToClipboard = function (text) { navigator.clipboard.writeText(text).then(() => window.showToast('Copied to clipboard!')); };
  window.ProMcBot = Object.freeze({ serverPath });
  document.addEventListener('DOMContentLoaded', init);
})();
