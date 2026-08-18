# Session 4 Checkpoint — فحص dash وإصلاح Discovery

## طلب المستخدم: فحص dash ملف بملف، حل ثغرات، لا تكرار (configuration في settings)، زبط navbar/أزرار، **شيل docs and tools**، **fix discovery servers** ليعرض سيرفرات MongoDB الحقيقية المرتبطة.

## المنجز:
### Docs/Tools حُذف ✓:
- حُذف: docs.html, commands.html (عامة), pages/mc-lookup.html
- Routes حُذفت: /docs, /commands, /mc-lookup, /api/mc/:addr (cleanup كامل بـ scripts/fix_mc_route.py)
- home.html: أزيل navbar links + tools section HTML + tools CSS + hero-badge-tag
- i18n.js: حُذف 48 مفتاح. home.html cache v=9. shared.css ما زال v=8.
- scripts/upgrade_home_tokens.py: رفع home إلى bg أعمق (#030409)

### إصلاحات:
- index.js سطر ~489: botPresent fix (global.__dashClients.bot → Array.isArray find) ✓ (scripts/fix_botpresent.py)
- ✅ /api/servers-linked أُضيف (scripts/add_servers_linked.py): يرجع guilds enriched بـ { linked: { botConfigured, mcServerInfo, mcSetup, config, mcServer, mcSetup } } من BotConfig + Server model + MinecraftConfig (apiUrl) + botClient حقيقي
- pages/servers.html: fetch → /api/servers-linked (v=9)، chips HTML + CSS (scripts/upgrade_servers_discovery.py + add_chips_css.py) — chips: Configured / MC Server / MC Setup / Not linked yet
- settings.html: `${API}/config` → `${API}` (فكسر)، Test Connection: /api/mc → مباشر mcsrvstat.us (CORS)
- pages/commands.html (داخلية sidebar): تعمل، لكن تعرض "No commands found" لو DB فارغة

### Models مهمة:
- BotConfig: guildId unique
- Server (serverinformations-promc): serverId, serverName, javaIP, javaPort, bedrockIP, serverType, wallpaper, premiumKey, interactionsCount
- MinecraftConfig (minecraft-config): guildId, apiUrl, bearerToken, premiumKey
- ServerStatus: name, status, lastChecked (بسيطة)
- require('../bot/Models/Server') يجب أن يعمل داخل index.js

## نتائج إضافية (منجز):
- shared.css Version: 9.0 ✓
- كل صفحات HTML: cache-busters v=9 (29 ملف) ✓
- pages/commands.html: fallback قائمة 16 أمر حقيقي ✓ (scripts/fix_commands_page.py)
- local dev test: /api/servers-linked ✓ 200 يرجع { linked: {...} }، كل الصفحات 200 ✓ (dashboard: 301→redirect طبيعي، invite/commands/bugs على 404 لأنها legacy non-guild routes — ليست ضرورية)
- routes legacy بدون guildId: /overview /settings /moderation /roles /logs /auto-responder /premium /configuration /ticket /activity /server-status — كلها تُخدم isAuthenticated فقط
- invitebot route موجود (ليس /invite)
- kill local-dev: pkill -f "local-dev.js" (بجلسة منفصلة)
- Bot commands list في commands.html fallback: mc-setup, mc-info, mc-player, mc-players, mc-leaderboard, mc-execute, mc, playercard, avatar, ping, help, invite, claim, filter, log, whitelist (أسماء عربية descriptions)

## المتبقي:
1. pages/commands.html: حل "No commands found" — إذا DB فارغة اعرض قائمة افتراضية (استخرج الأوامر من bot/Commands: mc-player, mc-players, mc-info, mc-setup, mc-leaderboard, mc-execute, playercard, mc, avatar, claim, help, invite, ping, action, filter, log, settings, toggle, whitelist) — أو على الأقل رسالة أجمل
2. ⚠️ التحقق local: (LOCAL_DEV=1 SESSION_SECRET='local-dev-secret' node local-dev.js) port 3999 — kill أولاً: ps aux | grep "local-dev" | grep -v grep | awk '{print $2}' | xargs -r kill -9
3. commit + force push main → Railway (~3-5 min) ثم تحقق حي shared.css?v=9 + /my-servers + /dashboard/pages/settings
4. إبلاغ المستخدم: Ctrl+Shift+R + النتائج
5. scripts/*.py المؤقتة موجودة في /home/ubuntu/Mybott_revamp/scripts/ — احذفها قبل commit أو أضفها؟ الأفضل حذفها (clean)
6. node -c dash/index.js ✓ حاليًا
7. owner: 804999528129363998, guild test: 1059183076636372993
