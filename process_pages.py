import os
import re

files_to_process = [
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\overview.html",
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\settings.html",
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\moderation.html",
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\roles.html"
]

navbar_html = """<nav class="navbar">
  <div class="logo_item">
    <i class="bx bx-menu mobile-toggle" id="sidebarToggle"></i>
    <img src="https://i.ibb.co/7GCzzTZ/7df0b585344a4e68c64e52c419129aa4.webp" alt="ProMcBot">
    <span class="brand-name">ProMcBot</span>
  </div>
  <div class="search_bar"><input type="text" id="searchInput" placeholder="Search..."></div>
  <div class="navbar_content">
    <div class="dropdown">
      <div class="nav-icon-btn" id="notificationBtn"><i class='bx bx-bell'></i><span class="notification-badge">3</span></div>
      <div class="dropdown-content notification-dropdown" id="notificationDropdown">
        <div class="dropdown-header"><i class='bx bx-bell'></i> Notifications</div>
        <div class="notification-item">
          <div class="notification-icon"><i class='bx bx-info-circle'></i></div>
          <div class="notification-content">
            <div class="notification-title">Welcome back!</div>
            <div class="notification-desc">Manage your servers from the dashboard</div>
            <div class="notification-time">Just now</div>
          </div>
        </div>
        <div class="dropdown-footer">View All</div>
      </div>
    </div>
    <div class="nav-icon-btn" id="darkLight" title="Toggle theme"><i class='bx bx-sun'></i></div>
    <div class="dropdown">
      <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="User" class="user-avatar" id="userBtn" data-user-avatar>
      <div class="dropdown-content" id="userDropdown">
        <div class="dropdown-header"><img data-user-avatar src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" style="width:32px;height:32px;border-radius:50%;margin-right:8px"><span id="navUserName">User</span></div>
        <a href="/dashboard"><i class='bx bx-user'></i> My Profile</a>
        <a href="/servers"><i class='bx bx-server'></i> My Servers</a>
        <a href="/premium"><i class='bx bx-crown'></i> Premium</a>
        <div style="border-top:1px solid var(--border);margin:4px 0"></div>
        <a href="/api/logout" style="color:var(--danger)"><i class='bx bx-log-out'></i> Logout</a>
      </div>
    </div>
  </div>
</nav>"""

def get_sidebar_html(page_name):
    # active logic based on page name
    html = '<nav class="sidebar" id="sidebar">\n  <div class="menu_content">\n    <ul class="menu_items">\n      <div class="menu_title"><span>User</span></div>\n'
    
    user_links = [
        ('/dashboard', 'bx bx-user', 'Profile', False),
        ('/servers', 'bx bx-server', 'Servers', False),
        ('/premium', 'bx bx-crown', 'Premium', True)
    ]
    for href, icon, text, is_new in user_links:
        active_cls = ' active' if page_name == href.strip('/') else ''
        html += f'      <li class="item"><a href="{href}" class="nav_link{active_cls}"><span class="navlink_icon"><i class=\'{icon}\'></i></span><div class="navlink-container"><span class="navlink">{text}</span>'
        if is_new:
            html += '<span class="tag tag-new">New</span>'
        html += '</div></a></li>\n'
    html += '    </ul>\n'
    
    html += '    <ul class="menu_items">\n      <div class="menu_title"><span>Server</span></div>\n'
    server_links = [
        ('/overview', 'bx bx-stats', 'Overview'),
        ('/settings', 'bx bx-cog', 'Settings'),
        ('/moderation', 'bx bx-shield', 'Moderation'),
        ('/roles', 'bx bx-palette', 'Roles'),
        ('/logs', 'bx bx-notepad', 'Logs'),
        ('/auto-responder', 'bx bx-bot', 'Auto Responder'),
        ('/configuration', 'bx bx-slider-alt', 'Configuration'),
        ('/ticket', 'bx bx-support', 'Tickets')
    ]
    for href, icon, text in server_links:
        active_cls = ' active' if page_name == href.strip('/') else ''
        html += f'      <li class="item"><a href="{href}" class="nav_link{active_cls}"><span class="navlink_icon"><i class=\'{icon}\'></i></span><div class="navlink-container"><span class="navlink">{text}</span></div></a></li>\n'
    html += '    </ul>\n'

    html += '    <ul class="menu_items">\n      <div class="menu_title"><span>Other</span></div>\n'
    other_links = [
        ('/invitebot', 'bx bx-cube-alt', 'Invite Bot'),
        ('/commands', 'bx bx-command', 'Commands'),
        ('/api/logout', 'bx bx-log-out', 'Logout')
    ]
    for href, icon, text in other_links:
        active_cls = ' active' if page_name == href.strip('/') else ''
        html += f'      <li class="item"><a href="{href}" class="nav_link{active_cls}"><span class="navlink_icon"><i class=\'{icon}\'></i></span><div class="navlink-container"><span class="navlink">{text}</span></div></a></li>\n'
    html += '    </ul>\n  </div>\n'
    html += '  <div class="sidebar-footer">\n    <div class="collapse-btn"><i class=\'bx bx-chevron-left\'></i><span>Collapse</span></div>\n  </div>\n</nav>'
    return html

for file_path in files_to_process:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    filename = os.path.basename(file_path).replace('.html', '')
    
    # 1. Update <head>
    content = re.sub(r'<link[^>]*font-awesome[^>]*>', '', content)
    content = re.sub(r'<link[^>]*googleapis[^>]*>', '', content)
    content = re.sub(r'<link[^>]*boxicons[^>]*>', '', content)
    
    new_head_tags = '<link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">\n    <link rel="stylesheet" href="/shared.css">\n</head>'
    content = content.replace('</head>', new_head_tags)
    
    # 2 & 3. Standardize navbar & sidebar
    content = re.sub(r'<nav class="navbar">.*?</nav>', navbar_html, content, flags=re.DOTALL)
    content = re.sub(r'<nav class="sidebar"[^>]*>.*?</nav>', get_sidebar_html(filename), content, flags=re.DOTALL)
    
    # 5. Add class `main-content` to the main section if not present
    # Replace `<section>` or `<main>` with `<section class="main-content">` if they don't have it.
    # Looking at HTML, they often have `<div class="main-content">` or `<section class="main-content">`.
    # Let's check for it.
    
    # 7. Change CSS variables
    content = content.replace('var(--white-color)', 'var(--surface)')
    content = content.replace('var(--grey-color)', 'var(--text)')
    content = content.replace('var(--ggff)', 'var(--bg)')
    content = content.replace('var(--dark-bg)', 'var(--bg)')
    content = content.replace('var(--dark-card)', 'var(--surface)')
    content = content.replace('var(--card-bg)', 'var(--surface)')
    content = content.replace('var(--text-light)', 'var(--text)')
    
    # 4 & 6. Add shared.js and remove dark mode script logic
    if '<script src="/shared.js"></script>' not in content:
        content = content.replace('</body>', '    <script src="/shared.js"></script>\n</body>')
    
    # Try removing the style tags that are handled by shared CSS.
    # To do this safely, we can regex away some global blocks from the style tag.
    
    style_matches = re.finditer(r'<style>(.*?)</style>', content, re.DOTALL)
    for style_match in style_matches:
        original_style = style_match.group(1)
        new_style = original_style
        
        # We will use simple regexes to remove blocks
        new_style = re.sub(r'@import url\([^)]+\);\s*', '', new_style)
        
        # Function to remove CSS rule blocks
        def remove_rule(selector, css_text):
            # Matches `selector { ... }` where `...` has no `{` or `}`
            # Since CSS might have nested rules (like media queries), we just do simple search
            pattern = re.compile(selector + r'\s*{[^{}]*}', re.DOTALL)
            return pattern.sub('', css_text)

        selectors_to_remove = [
            r':root', r'(?<!\.)body', r'body\.dark', 
            r'\.navbar', r'\.logo_item', r'\.navbar img', r'\.search_bar',
            r'\.search_bar input', r'\.navbar_content', r'\.navbar_content i',
            r'\.mobile-toggle', r'\.notification-badge', r'\.dropdown', 
            r'\.dropdown-content', r'body\.dark \.dropdown-content',
            r'\.dropdown-content a', r'body\.dark \.dropdown-content a',
            r'\.dropdown-content a:hover', r'\.dropdown-content a i',
            r'\.dropdown-header', r'body\.dark \.dropdown-header',
            r'\.show', r'\.notification-dropdown', r'\.notification-item',
            r'body\.dark \.notification-item', r'\.notification-item:hover',
            r'\.notification-icon', r'\.notification-content', r'\.notification-title',
            r'\.notification-time', r'\.view-all', r'\.sidebar', r'\.navlink-container',
            r'\.tag', r'\.tag-new', r'\.tag-pro', r'\.tag-ult', r'\.tag-lg',
            r'\.sidebar\.close', r'\.sidebar::-webkit-scrollbar', r'\.menu_content',
            r'\.menu_title', r'\.sidebar\.close \.menu_title', 
            r'\.sidebar\.close \.menu_title span', r'\.sidebar\.close \.menu_title::after',
            r'\.menu_items', r'\.navlink_icon', r'\.navlink_icon::before',
            r'\.sidebar \.nav_link', r'\.sidebar\.close \.nav_link',
            r'\.sidebar\.close \.navlink', r'\.nav_link:hover',
            r'\.nav_link:hover \.navlink_icon', r'\.sidebar\.close \.nav_link:hover',
            r'\.sidebar\.close \.nav_link:hover \.navlink_icon',
            r'\.sidebar \.nav_link_on', r'\.nav_link_on', r'\.nav_link_on:hover \.navlink_icon',
            r'\.bottom_content', r'\.bottom', r'\.sidebar\.close \.bottom',
            r'\.bottom i', r'\.bottom span', r'\.sidebar\.close \.bottom span',
            r'\.main-content', r'\.sidebar\.close ~ \.main-content',
            r'\*\s*'
        ]
        
        for sel in selectors_to_remove:
            new_style = remove_rule(sel, new_style)
            
        content = content.replace(original_style, new_style)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Processed {filename}")
