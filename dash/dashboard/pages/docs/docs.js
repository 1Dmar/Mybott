(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('pmcbot-docs-theme');
  if (savedTheme === 'light') root.dataset.theme = 'light';
  const updateTheme = () => {
    if (!themeToggle) return;
    const light = root.dataset.theme === 'light';
    themeToggle.innerHTML = `<i class="bx ${light ? 'bx-moon' : 'bx-sun'}" aria-hidden="true"></i>`;
    themeToggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  };
  updateTheme();
  themeToggle?.addEventListener('click', () => {
    const light = root.dataset.theme === 'light';
    if (light) delete root.dataset.theme; else root.dataset.theme = 'light';
    localStorage.setItem('pmcbot-docs-theme', light ? 'dark' : 'light');
    updateTheme();
  });

  const sidebar = document.getElementById('docsSidebar');
  const menu = document.getElementById('menuToggle');
  menu?.addEventListener('click', () => {
    const open = sidebar?.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(Boolean(open)));
    menu.innerHTML = `<i class="bx ${open ? 'bx-x' : 'bx-menu'}" aria-hidden="true"></i>`;
  });
  sidebar?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    sidebar.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    if (menu) menu.innerHTML = '<i class="bx bx-menu" aria-hidden="true"></i>';
  }));

  const search = document.getElementById('docsSearch');
  const searchable = [...document.querySelectorAll('[data-searchable]')];
  const empty = document.getElementById('emptySearch');
  const runSearch = () => {
    if (!search || !searchable.length) return;
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    searchable.forEach(item => {
      const match = !query || item.textContent.toLowerCase().includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });
    if (empty) empty.classList.toggle('show', visible === 0);
  };
  search?.addEventListener('input', runSearch);
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search?.focus(); }
  });

  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      const old = button.innerHTML;
      button.innerHTML = '<i class="bx bx-check"></i>';
      setTimeout(() => { button.innerHTML = old; }, 1200);
    } catch (_) {}
  }));
  document.querySelectorAll('[data-year]').forEach(node => node.textContent = new Date().getFullYear());
})();
