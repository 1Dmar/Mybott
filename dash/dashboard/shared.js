/**
 * ProMcBot Dashboard - Shared JavaScript
 * Handles: Sidebar, Theme, Dropdowns, Toast notifications, Auth check
 * Version: 3.0
 */

(function () {
  'use strict';

  // ============================================================
  // THEME MANAGEMENT
  // ============================================================
  function initTheme() {
    const savedTheme = localStorage.getItem('pmcbot_theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
    }
    // Update sun/moon icon if present
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const icon = document.getElementById('darkLight');
    if (!icon) return;
    if (document.body.classList.contains('dark')) {
      icon.classList.remove('bx-sun');
      icon.classList.add('bx-moon');
    } else {
      icon.classList.remove('bx-moon');
      icon.classList.add('bx-sun');
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('pmcbot_theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
  }

  // ============================================================
  // SIDEBAR MANAGEMENT
  // ============================================================
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const collapseBtn = document.querySelector('.collapse-btn');
    let overlay = document.querySelector('.sidebar-overlay');

    if (!sidebar) return;

    // Create overlay if not exists
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    // Restore collapsed state on desktop
    const isCollapsed = localStorage.getItem('pmcbot_sidebar_collapsed') === 'true';
    if (window.innerWidth > 992 && isCollapsed) {
      sidebar.classList.add('close');
    }

    // Mobile toggle
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

    // Collapse button (desktop)
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

    // Handle window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    });

    // Active link highlight
    const currentPath = window.location.pathname;
    document.querySelectorAll('.sidebar .nav_link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (currentPath === href || currentPath.startsWith(href + '/'))) {
        link.classList.add('active');
      }
    });
  }

  // ============================================================
  // DROPDOWN MANAGEMENT
  // ============================================================
  function initDropdowns() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const userBtn = document.getElementById('userBtn');
    const userDropdown = document.getElementById('userDropdown');

    function closeAll() {
      if (notificationDropdown) notificationDropdown.classList.remove('show');
      if (userDropdown) userDropdown.classList.remove('show');
    }

    if (notificationBtn && notificationDropdown) {
      notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = notificationDropdown.classList.contains('show');
        closeAll();
        if (!isOpen) notificationDropdown.classList.add('show');
      });
    }

    if (userBtn && userDropdown) {
      userBtn.addEventListener('click', (e) => {
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
    if (darkLight) {
      darkLight.addEventListener('click', toggleTheme);
    }
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

    const icons = {
      success: 'bx-check-circle',
      error: 'bx-error-circle',
      warning: 'bx-error',
      info: 'bx-info-circle'
    };

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
        // Not logged in — redirect if on protected page
        const publicPaths = ['/', '/home', '/loading-auth', '/auth/discord', '/privacy'];
        const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p));
        if (!isPublic) {
          window.location.href = '/';
        }
        return;
      }

      const data = await resp.json();
      if (!data.authenticated) return;

      const user = data.user;

      // Populate avatar(s)
      document.querySelectorAll('[data-user-avatar]').forEach(el => {
        el.src = user.avatar || `https://cdn.discordapp.com/embed/avatars/${(user.discriminator || 0) % 5}.png`;
      });

      // Populate username(s)
      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = user.global_name || user.username || 'User';
      });

      document.querySelectorAll('[data-user-username]').forEach(el => {
        el.textContent = user.username || '';
      });

      document.querySelectorAll('[data-user-id]').forEach(el => {
        el.textContent = user.id || '';
      });

      document.querySelectorAll('[data-user-email]').forEach(el => {
        el.textContent = user.email || 'Hidden';
      });

      // Welcome message
      document.querySelectorAll('[data-welcome-name]').forEach(el => {
        el.textContent = user.global_name || user.username || 'User';
      });

      // Navbar dropdown user display
      const navName = document.getElementById('navUserName');
      if (navName) navName.textContent = (user.global_name || user.username);

    } catch (err) {
      console.warn('[PMC] Auth check failed:', err.message);
    }
  }

  // ============================================================
  // COPY TO CLIPBOARD HELPER
  // ============================================================
  window.copyToClipboard = function (text, label) {
    navigator.clipboard.writeText(text).then(() => {
      window.showToast(`${label || 'Copied'} to clipboard!`, 'success');
    }).catch(() => {
      window.showToast('Failed to copy', 'error');
    });
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
  });

})();
