/**
 * ProMcBot Dashboard - Shared JavaScript (Revamped)
 * Handles: Sidebar (smart/context-aware), Theme, Dropdowns, Toast, Auth
 */

(function () {
  'use strict';

  const state = {
    user: null,
    currentGuildId: null,
    theme: localStorage.getItem('pmcbot_theme') || 'dark'
  };

  // ── Initialization ───────────────────────────────────────────
  async function init() {
    initTheme();
    await checkAuth();
    extractGuildId();
    initSidebar();
    initDropdowns();
    setupEventListeners();
  }

  // ── Auth System ──────────────────────────────────────────────
  async function checkAuth() {
    const publicPaths = ['/', '/loading-auth', '/privacy', '/auth/discord'];
    const isPublicPage = publicPaths.includes(window.location.pathname);
    
    try {
      const res = await fetch('/callback/check/userData');
      const data = await res.json();
      
      if (data.authenticated) {
        state.user = data.user;
        updateUserUI();
      } else if (!isPublicPage) {
        window.location.href = '/loading-auth';
      }
    } catch (e) {
      if (!isPublicPage) window.location.href = '/loading-auth';
    }
  }

  function updateUserUI() {
    const user = state.user || {};
    const displayName = user.global_name || user.username || 'User';
    const avatar = user.avatar || '/dashboard/logo.png';
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = displayName);
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      el.src = avatar;
      el.onerror = () => { el.onerror = null; el.src = '/dashboard/logo.png'; };
    });
    document.querySelectorAll('[data-user-id]').forEach(el => el.textContent = user.id || '—');
    document.querySelectorAll('[data-user-username]').forEach(el => el.textContent = user.username || displayName);

    const navName = document.getElementById('navUserName');
    if (navName) navName.textContent = displayName;
  }

  // ── Theme Management ─────────────────────────────────────────
  function initTheme() {
    document.body.classList.toggle('dark', state.theme === 'dark');
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const icon = document.querySelector('#darkLight i') || document.querySelector('#darkLight');
    if (!icon) return;
    icon.className = state.theme === 'dark' ? 'bx bx-sun' : 'bx bx-moon';
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pmcbot_theme', state.theme);
    document.body.classList.toggle('dark', state.theme === 'dark');
    updateThemeIcon();
  }

  // ── Sidebar System ───────────────────────────────────────────
  function extractGuildId() {
    const match = window.location.pathname.match(/\/servers\/(\d+)/);
    if (match) state.currentGuildId = match[1];
  }

  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const gId = state.currentGuildId;
    let menuContent = sidebar.querySelector('.menu_content');
    if (!menuContent) {
      menuContent = document.createElement('div');
      menuContent.className = 'menu_content';
      const footer = sidebar.querySelector('.sidebar-footer');
      if (footer) {
        sidebar.insertBefore(menuContent, footer);
      } else {
        sidebar.appendChild(menuContent);
      }
    }

    const currentPath = window.location.pathname;
    
    let html = `
      <ul class="menu_items">
        <div class="menu_title"><span>Main</span></div>
        <li class="item"><a href="/dashboard" class="nav_link ${currentPath === '/dashboard' ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-user"></i></span><span class="navlink">Profile</span></a></li>
        <li class="item"><a href="/servers" class="nav_link ${currentPath === '/servers' ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-server"></i></span><span class="navlink">My Servers</span></a></li>
        <li class="item"><a href="/intelligence" class="nav_link ${currentPath === '/intelligence' || currentPath === '/onboarding' ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-line-chart"></i></span><span class="navlink">Intelligence</span></a></li>
        <li class="item"><a href="/actions" class="nav_link ${currentPath === '/actions' ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-check-square"></i></span><span class="navlink">Action Center</span></a></li>
        <li class="item"><a href="/premium" class="nav_link ${currentPath === '/premium' ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-crown"></i></span><span class="navlink">Premium Center</span></a></li>
      </ul>
    `;

    if (gId) {
      html += `
        <ul class="menu_items">
          <div class="menu_title"><span>Server Control</span></div>
          <li class="item"><a href="/servers/${gId}/overview" class="nav_link ${currentPath.includes('/overview') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-grid-alt"></i></span><span class="navlink">Overview</span></a></li>
          <li class="item"><a href="/servers/${gId}/intelligence" class="nav_link ${currentPath.includes('/intelligence') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-line-chart"></i></span><span class="navlink">Server Intelligence</span></a></li>
          <li class="item"><a href="/servers/${gId}/settings" class="nav_link ${currentPath.includes('/settings') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-cog"></i></span><span class="navlink">Settings</span></a></li>
          <li class="item"><a href="/servers/${gId}/modules" class="nav_link ${currentPath.includes('/modules') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-extension"></i></span><span class="navlink">Modules</span></a></li>
          <li class="item"><a href="/servers/${gId}/logs" class="nav_link ${currentPath.includes('/logs') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-list-ul"></i></span><span class="navlink">Audit Logs</span></a></li>
          <li class="item"><a href="/servers/${gId}/premium" class="nav_link ${currentPath.includes('/premium') ? 'active' : ''}"><span class="navlink_icon"><i class="bx bx-crown"></i></span><span class="navlink">Premium</span></a></li>
        </ul>
      `;
    }

    menuContent.innerHTML = html;
  }

  function initSidebar() {
    buildSidebar();
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (!sidebar) return;

    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    const closeMobileSidebar = () => {
      sidebar.classList.add('close');
      backdrop.classList.remove('show');
    };
    const toggleSidebar = () => {
      sidebar.classList.toggle('close');
      backdrop.classList.toggle('show', !sidebar.classList.contains('close'));
    };

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    const closeButton = document.getElementById('sidebar-close');
    if (closeButton) closeButton.addEventListener('click', closeMobileSidebar);
    backdrop.addEventListener('click', closeMobileSidebar);
    sidebar.addEventListener('click', event => {
      if (event.target.closest('.nav_link') && window.matchMedia('(max-width: 768px)').matches) closeMobileSidebar();
    });
  }

  // ── Dropdowns ────────────────────────────────────────────────
  function initDropdowns() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const userBtn = document.getElementById('userBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (notificationBtn && notificationDropdown) {
      notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('show');
        if (userDropdown) userDropdown.classList.remove('show');
      });
    }

    if (userBtn && userDropdown) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
        if (notificationDropdown) notificationDropdown.classList.remove('show');
      });
    }

    document.addEventListener('click', () => {
      if (notificationDropdown) notificationDropdown.classList.remove('show');
      if (userDropdown) userDropdown.classList.remove('show');
    });
  }

  // ── Events ───────────────────────────────────────────────────
  function setupEventListeners() {
    const themeBtn = document.getElementById('darkLight');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  }

  // Toast System
  window.showToast = function (message, type = 'success') {
    console.log(`[Toast] ${type}: ${message}`);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
      window.showToast('Copied to clipboard!');
    });
  };

  document.addEventListener('DOMContentLoaded', init);
})();
