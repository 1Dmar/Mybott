import os
import re

pages_dir = r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages"

def clean_css(content):
    # Remove old :root overrides if they contain common vars
    content = re.sub(r':root\s*\{[^}]*--white-color[^}]*\}', '', content, flags=re.DOTALL)
    content = re.sub(r':root\s*\{[^}]*--blue:[^}]*\}', '', content, flags=re.DOTALL)
    
    # Remove dark mode overrides
    content = re.sub(r'body\.dark\s*\{[^}]*\}', '', content, flags=re.DOTALL)
    
    # Remove old sidebar css blocks
    content = re.sub(r'\.sidebar[^\{]*\{[^}]*\}', '', content, flags=re.DOTALL)
    content = re.sub(r'\.nav_link[^\{]*\{[^}]*\}', '', content, flags=re.DOTALL)
    
    # Remove old navbar css
    content = re.sub(r'\.navbar[^\{]*\{[^}]*\}', '', content, flags=re.DOTALL)
    
    # Remove duplicate google font imports
    content = re.sub(r'@import url\("https://fonts.googleapis.com/css2\?family=Poppins[^"]*"\);', '', content)
    
    return content

def clean_js(content):
    # Remove old sidebar/theme JS
    bad_js = [
        "const sidebar = document.querySelector('.sidebar');",
        "const sidebarToggle = document.getElementById('sidebarToggle');",
        "const darkLight = document.getElementById('darkLight');",
        "const body = document.querySelector('body');",
        "sidebarToggle.addEventListener('click', () => {",
        "sidebar.classList.toggle('close');",
        "sidebar.classList.toggle('active');",
        "darkLight.addEventListener('click', () => {",
        "body.classList.toggle('dark');",
        "if(body.classList.contains('dark'))",
        "localStorage.setItem('theme', 'dark')",
        "document.getElementById('year').textContent = new Date().getFullYear();"
    ]
    
    for string in bad_js:
        content = content.replace(string, '')
        
    return content

# The correct navbar
navbar_html = """<nav class="navbar">
    <div style="display:flex;align-items:center;gap:14px;">
      <div class="mobile-toggle" id="sidebarToggle">
        <i class='bx bx-menu'></i>
      </div>
      <a href="/dashboard" class="logo_item">
        <img src="/public/images/logo.png" alt="Logo" onerror="this.style.display='none'">
        <span class="brand-name">ProMcBot</span>
      </a>
    </div>

    <div class="navbar_content">
      <div class="nav-icon-btn" id="darkLight" title="Toggle theme">
        <i class='bx bx-sun'></i>
      </div>
      <div class="dropdown">
        <div class="nav-icon-btn" id="notificationBtn" title="Notifications">
          <i class='bx bx-bell'></i>
          <span class="notification-badge" id="notifBadge" style="display:none">0</span>
        </div>
        <div class="dropdown-content notification-dropdown" id="notificationDropdown">
          <div class="dropdown-header"><i class='bx bx-bell'></i> Notifications</div>
          <div class="notification-item">
            <div class="notification-icon"><i class='bx bx-info-circle'></i></div>
            <div class="notification-content">
              <div class="notification-title">Welcome to ProMcBot!</div>
              <div class="notification-desc">Select a server to start managing it</div>
            </div>
          </div>
          <div class="dropdown-footer">Mark all as read</div>
        </div>
      </div>
      <div class="dropdown">
        <img src="https://cdn.discordapp.com/embed/avatars/0.png"
             alt="Avatar" class="user-avatar" id="userBtn" data-user-avatar>
        <div class="dropdown-content" id="userDropdown">
          <div class="dropdown-header">
            <i class='bx bx-user'></i>
            <span id="navUserName">Loading...</span>
          </div>
          <a href="/dashboard"><i class='bx bx-user-circle'></i> My Profile</a>
          <a href="/servers"><i class='bx bx-server'></i> My Servers</a>
          <a href="/commands"><i class='bx bx-command'></i> Commands</a>
          <div style="border-top:1px solid var(--border);margin:4px 0"></div>
          <a href="/api/logout" style="color:var(--danger)"><i class='bx bx-log-out'></i> Logout</a>
        </div>
      </div>
    </div>
  </nav>"""

def replace_navbar(content):
    pattern = r'<nav\s+class="navbar"\s*>.*?</nav>'
    return re.sub(pattern, navbar_html, content, flags=re.DOTALL)

def ensure_shared_js(content):
    if '<script src="/shared.js"></script>' not in content:
        content = content.replace('</body>', '<script src="/shared.js"></script>\n</body>')
    return content

for filename in os.listdir(pages_dir):
    if not filename.endswith('.html'): continue
    filepath = os.path.join(pages_dir, filename)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    content = clean_css(content)
    content = clean_js(content)
    content = replace_navbar(content)
    content = ensure_shared_js(content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Cleaned {filename}")
    else:
        print(f"Skipped {filename} (no changes)")
