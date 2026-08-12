/**
 * ProMcBot Dashboard - Shared JavaScript
 * Handles: Sidebar (smart/context-aware), Theme, Dropdowns, Toast, Auth
 * Version: 4.0
 */

(function () {
  'use strict';

  // ============================================================
  // THEME MANAGEMENT
  // ============================================================
  function initTheme() {
    const savedTheme = localStorage.getItem('pmcbot_theme') || 'dark';
    if (savedTheme === 'dark') document.body.classList.add('dark');
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const icon = document.getElementById('darkLight');
    if (!icon) return;
    if (document.body.classList.contains('dark')) {
      icon.classList.remove('bx-sun'); icon.classList.add('bx-moon');
    } else {
      icon.classList.remove('bx-moon'); icon.classList.add('bx-sun');
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('pmcbot_theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
  }

  // ============================================================
  // SMART SIDEBAR BUILDER
  // Detects current route and builds sidebar links dynamically
  // ============================================================

  // Parse guild ID from URL like /servers/123456/overview
  function getGuildIdFromPath() {
    const match = window.location.pathname.match(/^\/servers\/(\d+)/);
    return match ? match[1] : null;
  }

  // Nav config for each context
  const NAV_CONFIG = {
    // User-level pages (no specific server selected)
    user: [
      {
        label: 'My Space',
        items: [
          { href: '/dashboard', icon: 'bx-user', text: 'Profile' },
          { href: '/servers', icon: 'bx-server', text: 'My Servers' },
          { href: '/premium', icon: 'bx-crown', text: 'Premium', tag: { text: 'Pro', cls: 'tag-pro' } },
          { href: '/commands', icon: 'bx-command', text: 'Commands' },
        ]
      },
      {
        label: 'Explore',
        items: [
          { href: '/invitebot', icon: 'bx-plus-circle', text: 'Invite Bot' },
          { href: '/activity', icon: 'bx-pulse', text: 'Activity' },
          { href: '/server-status', icon: 'bx-broadcast', text: 'Server Status' },
        ]
      },
      {
        label: 'Account',
        items: [
          { href: '/api/logout', icon: 'bx-log-out', text: 'Logout', cls: 'logout-link' },
        ]
      }
    ],

    // Server-specific pages
    server: (guildId) => [
      {
        label: 'Server',
        items: [
          { href: `/servers/${guildId}/overview`,       icon: 'bx-home-alt',    text: 'Overview' },
          { href: `/servers/${guildId}/configuration`,  icon: 'bx-slider',      text: 'Configuration' },
          { href: `/servers/${guildId}/modules`,        icon: 'bx-extension',   text: 'Modules' },
        ]
      },
      {
        label: 'Moderation',
        items: [
          { href: `/servers/${guildId}/moderation`,    icon: 'bx-shield',      text: 'Moderation' },
          { href: `/servers/${guildId}/roles`,          icon: 'bx-group',       text: 'Roles' },
          { href: `/servers/${guildId}/logs`,           icon: 'bx-list-ul',     text: 'Logs' },
        ]
      },
      {
        label: 'Features',
        items: [
          { href: `/servers/${guildId}/auto-responder`, icon: 'bx-bot',         text: 'Auto Responder' },
          { href: `/servers/${guildId}/ticket`,         icon: 'bx-support',     text: 'Tickets' },
          { href: `/servers/${guildId}/welcome`,        icon: 'bx-door-open',   text: 'Welcome' },
          { href: `/servers/${guildId}/settings`,       icon: 'bx-cog',         text: 'Settings' },
        ]
      },
      {
        label: 'Management',
        items: [
          { href: `/servers/${guildId}/members`,        icon: 'bx-user-circle', text: 'Members' },
          { href: `/servers/${guildId}/premium`,        icon: 'bx-crown',       text: 'Premium', tag: { text: 'Pro', cls: 'tag-pro' } },
          { href: `/servers/${guildId}/danger`,         icon: 'bx-error-circle', text: 'Danger Zone', cls: 'danger-link' },
        ]
      },
      {
        label: 'Navigation',
        items: [
          { href: '/servers',      icon: 'bx-arrow-back', text: 'Back to Servers' },
          { href: '/api/logout',   icon: 'bx-log-out',    text: 'Logout', cls: 'logout-link' },
        ]
      }
    ]
  };

  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const guildId = getGuildIdFromPath();
    const currentPath = window.location.pathname;
    const isAdminPage = currentPath.startsWith('/admin');

    // Choose sections based on context
    let sections;
    if (guildId) {
      sections = NAV_CONFIG.server(guildId);
    } else {
      sections = [...NAV_CONFIG.user];
      // Inject Admin section if on admin pages OR if user is owner
      // We check for a data attribute set by initAuth
      if (isAdminPage || document.body.dataset.isAdmin === 'true') {
        sections = [
          ...sections,
          {
            label: 'Admin Panel',
            items: [
              { href: '/admin',           icon: 'bx-shield-quarter',  text: 'Overview', cls: 'admin-link' },
              { href: '/admin/stats',     icon: 'bx-bar-chart-alt-2', text: 'Statistics', cls: 'admin-link' },
              { href: '/admin/users',     icon: 'bx-user-check',      text: 'Users', cls: 'admin-link' },
              { href: '/admin/email',     icon: 'bx-envelope',        text: 'Send Email', cls: 'admin-link' },
              { href: '/admin/sendembed', icon: 'bx-message-square-dots', text: 'Send Embed', cls: 'admin-link' },
              { href: '/admin/bugs',      icon: 'bx-bug',             text: 'Bug Reports', cls: 'admin-link' },
            ]
          }
        ];
      }
    }

    // Keep existing sidebar-footer (collapse button), rebuild menu_content
    let menuContent = sidebar.querySelector('.menu_content');
    if (!menuContent) {
      menuContent = document.createElement('div');
      menuContent.className = 'menu_content';
      sidebar.insertBefore(menuContent, sidebar.querySelector('.sidebar-footer'));
    }

    // Build server context header if on server page
    let serverHeader = '';
    if (guildId) {
      const guildName = localStorage.getItem(`guild_name_${guildId}`) || 'Server';
      const guildIcon = localStorage.getItem(`guild_icon_${guildId}`);
      const iconHtml = guildIcon
        ? `<img src="${guildIcon}" alt="${guildName}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);">`
        : `<div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:white;">${guildName.charAt(0)}</div>`;

      serverHeader = `
        <div class="sidebar-server-header">
          ${iconHtml}
          <div class="sidebar-server-info">
            <div class="sidebar-server-name">${guildName}</div>
            <div class="sidebar-server-id">${guildId}</div>
          </div>
        </div>`;
    }

    // Build HTML
    let html = serverHeader;

    sections.forEach(section => {
      html += `<ul class="menu_items"><div class="menu_title"><span>${section.label}</span></div>`;
      section.items.forEach(item => {
        const isActive = currentPath === item.href || (item.href !== '/servers' && currentPath.startsWith(item.href));
        const activeClass = isActive ? ' active' : '';
        const extraClass = item.cls ? ` ${item.cls}` : '';
        const tagHtml = item.tag ? `<span class="tag ${item.tag.cls}">${item.tag.text}</span>` : '';

        html += `
          <li class="item">
            <a href="${item.href}" class="nav_link${activeClass}${extraClass}">
              <span class="navlink_icon"><i class="bx ${item.icon}"></i></span>
              <div class="navlink-container">
                <span class="navlink">${item.text}</span>
                ${tagHtml}
              </div>
            </a>
          </li>`;
      });
      html += `</ul>`;
    });

    menuContent.innerHTML = html;
  }

  // ============================================================
  // SIDEBAR MECHANICS (toggle, mobile, resize)
  // ============================================================
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const collapseBtn = document.querySelector('.collapse-btn');
    let overlay = document.querySelector('.sidebar-overlay');

    if (!sidebar) return;

    // Build smart nav
    buildSidebar();

    // Create overlay if needed
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    // Restore collapsed state on desktop
    const isCollapsed = localStorage.getItem('pmcbot_sidebar_collapsed') === 'true';
    if (window.innerWidth > 992 && isCollapsed) sidebar.classList.add('close');

    // Mobile hamburger
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          sidebar.classList.toggle('active');
          overlay.classList.toggle('active');
        } else {
          sidebar.classList.toggle('close');
          localStorage.setItem('pmcbot_sidebar_collapsed', sidebar.classList.contains('close'));
        }
      });
    }

    // Desktop collapse button
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        sidebar.classList.toggle('close');
        localStorage.setItem('pmcbot_sidebar_collapsed', sidebar.classList.contains('close'));
      });
    }

    // Close on overlay click (mobile)
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });

    // Handle resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    });
  }

  // ============================================================
  // DROPDOWN MANAGEMENT
  // ============================================================
  function ensureNotificationUi() {
    const notificationBtn = document.getElementById('notificationBtn');
    if (!notificationBtn) return { badge: null, dropdown: null };

    let badge = document.getElementById('notifBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'notifBadge';
      badge.className = 'notification-badge';
      badge.textContent = '0';
      badge.style.display = 'none';
      notificationBtn.appendChild(badge);
    }

    let dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'notificationDropdown';
      dropdown.className = 'dropdown-content notification-dropdown';
      dropdown.innerHTML = '<div class="dropdown-header"><i class="bx bx-bell"></i> Notifications</div><div class="dropdown-content-body"></div>';
      notificationBtn.parentElement?.appendChild(dropdown);
    }

    return { badge, dropdown };
  }

  function initDropdowns() {
    const notificationUi = ensureNotificationUi();
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = notificationUi.dropdown;
    const userBtn = document.getElementById('userBtn');
    const userDropdown = document.getElementById('userDropdown');

    function closeAll() {
      if (notificationDropdown) notificationDropdown.classList.remove('show');
      if (userDropdown) userDropdown.classList.remove('show');
    }

    if (notificationBtn && notificationDropdown) {
      notificationBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = notificationDropdown.classList.contains('show');
        closeAll();
        if (!isOpen) notificationDropdown.classList.add('show');
      });
    }

    if (userBtn && userDropdown) {
      userBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = userDropdown.classList.contains('show');
        closeAll();
        if (!isOpen) userDropdown.classList.add('show');
      });
    }

    document.addEventListener('click', closeAll);
  }

  // ============================================================
  // THEME BUTTON
  // ============================================================
  function initThemeBtn() {
    const darkLight = document.getElementById('darkLight');
    if (darkLight) darkLight.addEventListener('click', toggleTheme);
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  window.showToast = function (message, type = 'success', duration = 3500) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: 'bx-check-circle', error: 'bx-error-circle', warning: 'bx-error', info: 'bx-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="bx ${icons[type] || icons.info}" style="font-size:20px;flex-shrink:0"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ============================================================
  // AUTH CHECK & USER INFO POPULATION
  // ============================================================
  async function initAuth() {
    try {
      const resp = await fetch('/callback/check/userData');
      if (!resp.ok) {
        const publicPaths = ['/', '/home', '/loading-auth', '/auth/discord', '/privacy'];
        const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p));
        if (!isPublic) window.location.href = '/';
        return;
      }

      const data = await resp.json();
      if (!data.authenticated) return;
      const user = data.user;

      // Populate avatar
      document.querySelectorAll('[data-user-avatar]').forEach(el => {
        el.src = user.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`;
      });
      document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.global_name || user.username || 'User'; });
      document.querySelectorAll('[data-user-username]').forEach(el => { el.textContent = user.username || ''; });
      document.querySelectorAll('[data-user-id]').forEach(el => { el.textContent = user.id || ''; });
      document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = user.email || 'Hidden'; });
      document.querySelectorAll('[data-welcome-name]').forEach(el => { el.textContent = user.global_name || user.username || 'User'; });

      const navName = document.getElementById('navUserName');
      if (navName) navName.textContent = user.global_name || user.username;

      // Store guilds count for profile page
      window.__pmcUser = user;

      // Tag body so sidebar can show admin links
      const ADMIN_IDS = (window.__adminIds || '804999528129363998').split(',');
      if (ADMIN_IDS.includes(user.id)) {
        document.body.dataset.isAdmin = 'true';
        // Rebuild sidebar so admin section appears
        buildSidebar();
      }

    } catch (err) {
      console.warn('[PMC] Auth check failed:', err.message);
    }
  }

  // ============================================================
  // COPY TO CLIPBOARD
  // ============================================================
  window.copyToClipboard = function (text, label) {
    navigator.clipboard.writeText(text).then(() => {
      window.showToast(`${label || 'Copied'} to clipboard!`, 'success');
    }).catch(() => window.showToast('Failed to copy', 'error'));
  };

  // ============================================================
  // REAL-TIME DASHBOARD NOTIFICATIONS
  // ============================================================
  async function initNotifications() {
    const ui = ensureNotificationUi();
    const badge = ui.badge;
    const dropdown = ui.dropdown;
    if (!badge || !dropdown) return;

    const body = dropdown.querySelector('.dropdown-content-body') || dropdown;

    async function refreshNotifications() {
      try {
        const res = await fetch('/api/notifications', { credentials: 'same-origin' });
        if (!res.ok) {
          body.innerHTML = '<div class="notification-empty">Unable to load notifications right now.</div>';
          return;
        }
        const data = await res.json();
        if (!data.success) {
          body.innerHTML = '<div class="notification-empty">No notifications available.</div>';
          return;
        }

        const items = data.notifications || [];
        badge.textContent = String(items.length);
        badge.style.display = items.length > 0 ? 'inline-flex' : 'none';

        body.innerHTML = items.length
          ? items.map(item => `
            <div class="notification-item">
              <div class="notification-icon"><i class='bx ${item.icon || 'bx-info-circle'}'></i></div>
              <div class="notification-content">
                <div class="notification-title">${item.title}</div>
                <div class="notification-desc">${item.description}</div>
                <div class="notification-time">${item.time || 'Just now'}</div>
              </div>
            </div>
          `).join('')
          : '<div class="notification-empty">No new notifications.</div>';
      } catch (err) {
        console.warn('[PMC] Notification refresh failed:', err.message);
        body.innerHTML = '<div class="notification-empty">No new notifications.</div>';
      }
    }

    await refreshNotifications();
    setInterval(refreshNotifications, 25000);
  }

  // ============================================================
  // GUILD DATA CACHING HELPER
  // ============================================================
  window.cacheGuildInfo = function(guild) {
    if (guild && guild.id) {
      localStorage.setItem(`guild_name_${guild.id}`, guild.name || 'Server');
      if (guild.icon) {
        const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
        localStorage.setItem(`guild_icon_${guild.id}`, iconUrl);
      }
    }
  };

  // ============================================================
  // INIT ON DOM READY
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSidebar();
    initDropdowns();
    initThemeBtn();
    initAuth();
    initNotifications();
  });

})();
