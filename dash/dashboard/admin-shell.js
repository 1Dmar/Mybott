/* ProMcBot admin shell adapter for pages with custom content markup. */
(function () {
  'use strict';
  const adminPath = window.location.pathname;
  if (!adminPath.startsWith('/admin/')) return;

  function injectShell() {
    document.body.classList.add('admin-custom-shell');
    if (!document.getElementById('sidebar')) {
      const navbar = document.createElement('nav');
      navbar.className = 'navbar';
      navbar.innerHTML = `
        <div class="logo_item">
          <i class="bx bx-menu" id="sidebarToggle" aria-label="Open navigation" role="button" tabindex="0"></i>
          <img src="/dashboard/logo.png" alt="ProMcBot">
          <span class="brand-name">ProMcBot</span>
        </div>
        <div class="navbar_content">
          <i class="bx bx-sun" id="darkLight" role="button" tabindex="0" aria-label="Toggle theme"></i>
          <div class="user_profile_nav" id="userBtn">
            <img src="/dashboard/logo.png" alt="Account" data-user-avatar>
            <span id="navUserName" data-user-name>Admin</span>
            <i class="bx bx-chevron-down"></i>
            <div class="dropdown-menu" id="userDropdown"><a href="/dashboard">Account home</a><a href="/api/logout">Logout</a></div>
          </div>
        </div>`;
      document.body.insertBefore(navbar, document.body.firstChild);
    }
    if (!document.getElementById('sidebar')) {
      const sidebar = document.createElement('nav');
      sidebar.className = 'sidebar close';
      sidebar.id = 'sidebar';
      sidebar.innerHTML = `
        <div class="logo_items flex"><span class="nav_image"><img src="/dashboard/logo.png" alt="ProMcBot"></span><span class="logo_name">ProMcBot</span><i class="bx bx-x" id="sidebar-close" aria-label="Close navigation"></i></div>
        <div class="menu_container"><div class="menu_content"></div><div class="sidebar-footer"><div class="sidebar_profile flex"><span class="nav_image"><img src="/dashboard/logo.png" alt="Account" data-user-avatar></span><div class="data_text"><span class="name" data-user-name>Admin</span><span class="email" data-user-id>Admin access</span></div></div></div></div>`;
      document.body.insertBefore(sidebar, document.body.querySelector('.main-content') || document.body.children[1] || null);
    }
    const content = document.querySelector('.wrap, .lab-shell, .admin-wrap');
    if (content && !content.classList.contains('main-content')) {
      content.classList.add('main-content');
      if (content.classList.contains('admin-wrap')) content.classList.remove('admin-wrap');
    }
    document.querySelectorAll('.nav, .lab-nav, .admin-nav, .admin-sidebar').forEach(el => el.remove());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectShell, { once: true });
  else injectShell();
})();
