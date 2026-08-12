
# Script: update_sidebar.ps1
# Replaces hardcoded sidebar content in all dashboard pages
# with the dynamic empty sidebar that shared.js auto-builds

$pagesDir = "dash\dashboard\pages"
$pages = @(
    "activity.html",
    "auto_responder.html",
    "commands.html",
    "configuration.html",
    "invite.html",
    "logs.html",
    "moderation.html",
    "overview.html",
    "premium.html",
    "roles.html",
    "settings.html",
    "ticket.html",
    "users.html"
)

# The new minimal sidebar HTML
$newSidebar = @'
  <!-- SIDEBAR (auto-built by shared.js) -->
  <nav class="sidebar" id="sidebar">
    <div class="menu_content"></div>
    <div class="sidebar-footer">
      <div class="collapse-btn">
        <i class='bx bx-chevron-left'></i>
        <span>Collapse</span>
      </div>
    </div>
  </nav>
'@

$results = @()

foreach ($page in $pages) {
    $path = Join-Path $pagesDir $page
    if (-not (Test-Path $path)) {
        $results += "$page : SKIPPED (not found)"
        continue
    }

    $content = Get-Content $path -Raw

    # Check if it has a sidebar
    if ($content -notmatch 'id="sidebar"') {
        $results += "$page : SKIPPED (no sidebar found)"
        continue
    }

    # Use regex to replace the entire sidebar nav block
    # Matches: <nav class="sidebar" id="sidebar"> ... </nav>
    $pattern = '(?s)<nav\s+class="sidebar"\s+id="sidebar">.*?</nav>'
    $newContent = [regex]::Replace($content, $pattern, $newSidebar.Trim())

    if ($newContent -eq $content) {
        $results += "$page : NO CHANGE (regex did not match)"
        continue
    }

    Set-Content $path $newContent -NoNewline
    $results += "$page : UPDATED OK"
}

# Report
Write-Host ""
Write-Host "=== Sidebar Update Results ==="
foreach ($r in $results) {
    Write-Host $r
}
Write-Host ""
Write-Host "Done! $($results.Count) files processed."
