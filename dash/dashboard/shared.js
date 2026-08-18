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
  // Premium design: DARK is the default. A 'light' class activates light mode.
  // Legacy 'pmcbot_theme=dark' values are mapped to the default (no class).
  function initTheme() {
    const savedTheme = localStorage.getItem('pmcbot_theme') || 'dark';
    if (savedTheme === 'light') document.body.classList.add('light');
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const icon = document.getElementById('darkLight');
    if (!icon) return;
    if (document.body.classList.contains('light')) {
      icon.classList.remove('bx-moon'); icon.classList.add('bx-sun');
    } else {
      icon.classList.remove('bx-sun'); icon.classList.add('bx-moon');
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('pmcbot_theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
  }

  // ============================================================
  // SMART SIDEBAR BUILDER
  // Detects current route and builds sidebar links dynamically
  // ============================================================

  // Parse guild ID from URL like /my-servers/123456/overview
  function getGuildIdFromPath() {
    const match = window.location.pathname.match(/^\/my-servers\/(\d+)/);
    return match ? match[1] : null;
  }
  // Expose for page scripts (IIFE-scoped by default)
  window.getGuildIdFromPath = getGuildIdFromPath;

  // Nav config for each context
  const NAV_CONFIG = {
    // User-level pages (no specific server selected)
    user: [
      {
        label: 'sb.label_account',
        items: [
          { href: '/dashboard', icon: 'bx-user', text: 'nav.profile' },
          { href: '/my-servers', icon: 'bx-server', text: 'nav.my_servers' },
          { href: '/api/logout', icon: 'bx-log-out', text: 'nav.logout', cls: 'logout-link' },
        ]
      }
    ],

    // Server-specific pages
    server: (guildId) => [
      {
        label: 'sb.label_server',
        items: [
          { href: `/my-servers/${guildId}/overview`,       icon: 'bx-home-alt',    text: 'sb.overview' },
          { href: `/my-servers/${guildId}/configuration`,  icon: 'bx-slider',      text: 'sb.configuration' },
          { href: `/my-servers/${guildId}/modules`,        icon: 'bx-extension',   text: 'sb.modules' },
        ]
      },
      {
        label: 'sb.label_moderation',
        items: [
          { href: `/my-servers/${guildId}/moderation`,    icon: 'bx-shield',      text: 'sb.moderation' },
          { href: `/my-servers/${guildId}/roles`,          icon: 'bx-group',       text: 'sb.roles' },
          { href: `/my-servers/${guildId}/logs`,           icon: 'bx-list-ul',     text: 'sb.logs' },
        ]
      },
      {
        label: 'sb.label_features',
        items: [
          { href: `/my-servers/${guildId}/auto-responder`, icon: 'bx-bot',         text: 'sb.auto_responder' },
          { href: `/my-servers/${guildId}/ticket`,         icon: 'bx-support',     text: 'sb.tickets' },
          { href: `/my-servers/${guildId}/welcome`,        icon: 'bx-door-open',   text: 'sb.welcome' },
          { href: `/my-servers/${guildId}/players`,        icon: 'bx-user-plus',   text: 'sb.players' },
          { href: `/my-servers/${guildId}/settings`,       icon: 'bx-cog',         text: 'sb.settings' },
        ]
      },
      {
        label: 'sb.label_management',
        items: [
          { href: `/my-servers/${guildId}/members`,        icon: 'bx-user-circle', text: 'sb.members' },
          { href: `/my-servers/${guildId}/danger`,         icon: 'bx-error-circle', text: 'sb.danger', cls: 'danger-link' },
        ]
      },
      {
        label: 'sb.label_navigation',
        items: [
          { href: '/my-servers',      icon: 'bx-arrow-back', text: 'sb.back_servers' },
          { href: '/api/logout',   icon: 'bx-log-out',    text: 'nav.logout', cls: 'logout-link' },
        ]
      }
    ]
  };

  // ── i18n helper (safe if /i18n.js was not loaded)
  function itemLabel(val) {
    if (typeof val === 'string' && val !== '' && val.includes('.')) {
      const v = (window.__pmc_i18n && window.__pmc_i18n.get) ? window.__pmc_i18n.get(val) : null;
      if (v !== null) return v;
    }
    return String(val);
  }

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
            label: 'nav.admin',
            items: [
              { href: '/admin',           icon: 'bx-shield-quarter',  text: 'sb.admin_overview', cls: 'admin-link' },
              { href: '/admin/stats',     icon: 'bx-bar-chart-alt-2', text: 'sb.statistics', cls: 'admin-link' },
              { href: '/admin/users',     icon: 'bx-user-check',      text: 'sb.users', cls: 'admin-link' },
              { href: '/admin/email',     icon: 'bx-envelope',        text: 'sb.send_email', cls: 'admin-link' },
{ href: '/admin/sendembed', icon: 'bx-message-square-dots', text: 'sb.send_embed', cls: 'admin-link' },
              { href: '/admin/notifications', icon: 'bx-bell', text: 'nav.notification', cls: 'admin-link' },
              { href: '/admin/bugs',      icon: 'bx-bug',             text: 'sb.bug_reports', cls: 'admin-link' },
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
      html += `<ul class="menu_items"><div class="menu_title"><span>${itemLabel(section.label)}</span></div>`;
      section.items.forEach(item => {
        const isActive = currentPath === item.href || (item.href !== '/my-servers' && currentPath.startsWith(item.href));
        const activeClass = isActive ? ' active' : '';
        const extraClass = item.cls ? ` ${item.cls}` : '';
        const tagHtml = item.tag ? `<span class="tag ${item.tag.cls}">${item.tag.text}</span>` : '';

        html += `
          <li class="item">
            <a href="${item.href}" class="nav_link${activeClass}${extraClass}">
              <span class="navlink_icon"><i class="bx ${item.icon}"></i></span>
              <div class="navlink-container">
                <span class="navlink">${itemLabel(item.text)}</span>
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
      dropdown.innerHTML = `<div class="dropdown-header"><i class="bx bx-bell"></i> <span data-i18n="nav.notification">${itemLabel('nav.notification')}</span></div><div class="dropdown-content-body">${itemLabel('misc.loading')}</div>`;
      // Attach inside navbar (absolute positioning anchors to navbar) to avoid overlapping page content
      const nav = document.querySelector('.navbar');
      (nav || notificationBtn.parentElement)?.appendChild(dropdown);
    }

    return { badge, dropdown };
  }

  function ensureUserUi() {
    const userBtn = document.getElementById('userBtn');
    if (!userBtn) return null;
    let userDropdown = document.getElementById('userDropdown');
    if (!userDropdown) {
      userDropdown = document.createElement('div');
      userDropdown.id = 'userDropdown';
      userDropdown.className = 'dropdown-content';
      userDropdown.innerHTML = `
        <div class="dropdown-header"><i class="bx bx-user"></i> <span data-i18n="nav.my_account">${itemLabel('nav.my_account')}</span></div>
        <a href="/dashboard"><i class="bx bx-user-circle"></i> <span data-i18n="nav.profile">${itemLabel('nav.profile')}</span></a>
        <a href="/my-servers"><i class="bx bx-server"></i> <span data-i18n="nav.my_servers">${itemLabel('nav.my_servers')}</span></a>
        <a href="/api/logout" onclick="event.preventDefault(); navigator.sendBeacon('/api/logout'); location.href='/';"><i class="bx bx-log-out"></i> <span data-i18n="nav.logout">${itemLabel('nav.logout')}</span></a>`;
      const nav = document.querySelector('.navbar');
      (nav || userBtn.parentElement)?.appendChild(userDropdown);
    }
    return userDropdown;
  }

  function initDropdowns() {
    const notificationUi = ensureNotificationUi();
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = notificationUi.dropdown;
    const userBtn = document.getElementById('userBtn');
    const userDropdown = ensureUserUi();

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
    // ESC closes dropdowns
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll();
    });
  }

  // ============================================================
  // LANGUAGE SELECTOR (navbar)
  // ============================================================
  function initLanguageSelector() {
    try {
    if (!window.__pmc_i18n) return;
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    const darkLight = document.getElementById('darkLight');
    if (!darkLight) return;
    if (document.getElementById('langSelectWrap')) return; // avoid duplicates

    const wrap = document.createElement('div');
    wrap.id = 'langSelectWrap';
    wrap.className = 'nav-icon-btn lang-select-wrap';
    const lang = window.__pmc_i18n.getLangCookie() || 'en';
    const flags = { en: '🇬🇧', ar: '🇸🇦', es: '🇪🇸' };
    wrap.innerHTML = `
      <select id="langSelect" class="lang-select" aria-label="Language">
        ${['en', 'ar', 'es'].map(l => `<option value="${l}"${l === lang ? ' selected' : ''}>${flags[l]} ${l.toUpperCase()}</option>`).join('')}
      </select>`;
    (darkLight.parentNode || nav).insertBefore(wrap, darkLight);
    document.getElementById('langSelect').addEventListener('change', e => {
      window.__pmc_i18n.setLanguage(e.target.value);
    });
    } catch (e) { /* ignore; sidebar still works */ }
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

      // Populate avatar (API already returns full URL; fall back gracefully)
      const avatarUrl = (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http'))
        ? user.avatar
        : (user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/0.png`);
      document.querySelectorAll('[data-user-avatar]').forEach(el => {
        el.src = avatarUrl;
        el.onerror = () => { el.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; };
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
  // REAL-TIME IN-APP NOTIFICATIONS (navbar bell inbox)
  // ============================================================
  async function initNotifications() {
    const ui = ensureNotificationUi();
    const badge = ui.badge;
    const dropdown = ui.dropdown;
    if (!badge || !dropdown) return;

    const body = dropdown.querySelector('.dropdown-content-body') || dropdown;
    // header row (title + mark all read) rendered before items
    const headerWrap = dropdown.querySelector('.notification-header') || (() => {
      const h = document.createElement('div');
      h.className = 'notification-header';
      h.innerHTML = `<span class="notification-header-title">Notifications</span><button type="button" class="notification-mark-all" title="Mark all as read"><i class='bx bx-check-double'></i></button>`;
      dropdown.insertBefore(h, body);
      h.querySelector('.notification-mark-all').addEventListener('click', async () => {
        try {
          await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'same-origin' });
          await refreshNotifications();
          window.showToast && window.showToast('All notifications marked as read', 'success');
        } catch (_) {}
      });
      return h;
    })();

    function typeIcon(t) {
      return { info: 'bx-info-circle', success: 'bx-check-circle', warning: 'bx-error', error: 'bx-x-circle' }[t] || 'bx-bell';
    }

    async function refreshNotifications() {
      try {
        const [unreadRes, inboxRes] = await Promise.all([
          fetch('/api/notifications/unread', { credentials: 'same-origin' }),
          fetch('/api/notifications/inbox', { credentials: 'same-origin' })
        ]);
        const unread = unreadRes.ok ? (await unreadRes.json()) : null;
        const inbox = inboxRes.ok ? (await inboxRes.json()) : null;
        if (!unread || !inbox || !inbox.success) {
          body.innerHTML = `<div class="notification-empty">${itemLabel('misc.error')}</div>`;
          return;
        }

        const count = unread.unread || 0;
        badge.textContent = String(count);
        badge.style.display = count > 0 ? 'inline-flex' : 'none';

        const items = inbox.notifications || [];
        body.innerHTML = items.length
          ? items.map(item => `
            <div class="notification-item ${item.read ? '' : 'notification-unread'}" data-id="${item._id}">
              <div class="notification-icon"><i class='bx ${typeIcon(item.type)}'></i></div>
              <div class="notification-content">
                <div class="notification-title">${(item.title || 'Notification').replace(/</g,'&lt;')}${item.pinned ? ' <i class="bx bx-pin"></i>' : ''}</div>
                <div class="notification-desc">${(item.message || '').replace(/</g,'&lt;').slice(0, 140)}</div>
                <div class="notification-time">${item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</div>
                ${item.actionUrl ? `<a class="notification-action" href="${item.actionUrl.replace(/"/g,'')}" target="_blank" rel="noopener">${(item.actionLabel || 'Open').replace(/</g,'&lt;')}</a>` : ''}
              </div>
            </div>
          `).join('')
          : `<div class="notification-empty">${itemLabel('nav.no_notif')}</div>`;

        body.querySelectorAll('.notification-item').forEach(el => el.classList.add(el.classList.contains('notification-unread') ? 'notification-unread' : 'notification-read'));
      } catch (err) {
        console.warn('[PMC] Notification refresh failed:', err.message);
        body.innerHTML = `<div class="notification-empty">${itemLabel('nav.no_notif')}</div>`;
      }
    }

    await refreshNotifications();
    setInterval(refreshNotifications, 30000);
  }

  // ============================================================
  // CONTENT PROTECTION (anti-copy / anti-scrape deterrent)
  // ============================================================
  try {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => e.preventDefault());
    document.addEventListener('dragstart', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === 'U') ||
        (e.metaKey && e.altKey && e.key.toUpperCase() === 'I')
      ) {
        e.preventDefault();
      }
    }, true);
  } catch (e) {}

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
  // LANGUAGE BOOTSTRAP (runs as early as possible)
  // ============================================================
  if (window.__pmc_i18n) {
    window.__pmc_i18n.initLanguage();
  }

  // ============================================================
  // INIT ON DOM READY
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguageSelector();
    initSidebar();
    initDropdowns();
    initThemeBtn();
    initAuth();
    initNotifications();
    if (window.__pmc_i18n) {
      window.__pmc_i18n.applyTranslations();
    }
  });

})();
