import os
import re

files_to_process = [
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\overview.html",
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\settings.html",
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\moderation.html",
    r"c:\Users\PC\Desktop\sdf\mybott\dash\dashboard\pages\roles.html"
]

for file_path in files_to_process:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove JS related to darkLight, sidebar, etc that shared.js handles.
    # Theme toggle
    content = re.sub(r'// Theme toggle\s*darkLight\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    
    # Also apply saved theme logic
    content = re.sub(r'const savedTheme = localStorage\.getItem\(\'theme\'\);.*?\}\s*', '', content, flags=re.DOTALL)
    
    # Remove const declarations
    content = re.sub(r'const sidebar = document\.getElementById\(\'sidebar\'\);\s*', '', content)
    content = re.sub(r'const sidebarToggle = document\.getElementById\(\'sidebarToggle\'\);\s*', '', content)
    content = re.sub(r'const darkLight = document\.getElementById\(\'darkLight\'\);\s*', '', content)
    content = re.sub(r'const collapseBtn = document\.querySelector\(\'\.expand_sidebar\'\);\s*', '', content)
    content = re.sub(r'const notificationBtn = document\.getElementById\(\'notificationBtn\'\);\s*', '', content)
    content = re.sub(r'const notificationDropdown = document\.getElementById\(\'notificationDropdown\'\);\s*', '', content)
    content = re.sub(r'const userBtn = document\.getElementById\(\'userBtn\'\);\s*', '', content)
    content = re.sub(r'const userDropdown = document\.getElementById\(\'userDropdown\'\);\s*', '', content)
    
    # Toggle sidebar logic
    content = re.sub(r'// Toggle sidebar\s*sidebarToggle\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    content = re.sub(r'// Collapse sidebar\s*collapseBtn\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    content = re.sub(r'// Expand sidebar\s*sidebar\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    
    # Dropdown logic
    content = re.sub(r'// Dropdown functionality\s*notificationBtn\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    content = re.sub(r'userBtn\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    content = re.sub(r'// Close dropdowns when clicking outside\s*document\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    
    # Media query replacements for CSS missed
    content = re.sub(r'@media\s+screen\s+and\s+\(max-width:\s*992px\)\s*\{\s*\.sidebar\s*\{[^}]*\}\s*\.sidebar\.active\s*\{[^}]*\}\s*\.main-content\s*\{[^}]*\}\s*\.mobile-toggle\s*\{[^}]*\}\s*\.sidebar\.close\s*\{[^}]*\}\s*\.sidebar\.close\s*~\s*\.main-content\s*\{[^}]*\}\s*\}', '', content, flags=re.DOTALL)
    content = re.sub(r'@media\s+\(max-width:\s*992px\)\s*\{\s*\.sidebar\s*\{[^}]*\}\s*\.sidebar\.active\s*\{[^}]*\}\s*\.main-content\s*\{[^}]*\}\s*\.mobile-toggle\s*\{[^}]*\}\s*\}', '', content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Cleaned JS in {os.path.basename(file_path)}")
