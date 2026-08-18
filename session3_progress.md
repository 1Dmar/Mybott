# تقدم الجلسة 3 (2026-08-18)

## طلب المستخدم الحالي:
1. **حذف Website Builder نهائيًا** — جارٍ، شبه مكتمل
2. **أفكار قوية تجذب اللاعبين/أصحاب السيرفرات** — قادمة (المرحلة التالية)
3. **تصميم أفضل من Vetox** — داكن عميق، glow، charts، بدون اكتضاض، هوية برتقالية ProMcBot

## المرحلة 1 (حذف website) — حالة: شبه مكتملة
### تم حذفه:
- bot/Models/WebsiteSettings.js ✓
- dash/dashboard/pages/website.html, site-offline.html, site-view.html, servers-directory.html, docs/docs.html ✓
- routes من dash/index.js: require، /my-servers/:guildId/website، كتلة WEBSITE BUILDER كاملة (1048-1192)، /api/site/:id/settings، /api/site/:id/leaderboard، /api/directory، /servers-directory serve — بقي /mc-lookup و/api/mc/:addr ✓
- NAV website item من shared.js سطر 90 ✓
- 49 مفتاح i18n من dash/i18n.js (web.*, so.*, home.f4*, sb.website, nav.website, dir.*, pg.website_*) ✓
- server.js checks.website* ✓
- Terms.html وloading.html (hero_sub → "live tools") ✓
- docs.html: قسم website builder محذوف + TOC + FAQs + embedded i18n ✓

### متبقٍ في المرحلة 1:
- [ ] home.directory في docs.html embedded i18n (3 أماكن) — يمكن تركه أو حذفه (الصفحة غير موجودة الآن)
- [ ] mc.directory في i18n.js سطر 563 بدون استخدام — يحذف أو يبقى (غير ضار)
- [ ] test محلي (local-dev.js port 3999) + node -c لكل الملفات
- [ ] commit + push إلى main → Railway

### مفاتيح i18n المضافة لـ home.html: home.f4_title/desc الآن = Smart Auto Responder ✓ (يُستخدم)

## المرحلة 2 (الأفكار الجديدة) — تخطيط:
أفكار مرشحة:
1. **صفحة /tools عامة جديدة** — hub لأدوات مجانية: MC Lookup (موجود) + Bot Invite + Docs + Player Card + Commands viewer
2. **Live Bot Commands page** (/commands) — كل أوامر البوت مع بحث — تجذب اللاعبين
3. **Player Card Preview** — كرت لاعب فخم في mc-lookup
4. **Home جديد بـ sections**: hero + stats + features (moderation/tickets/auto-responder/stats/tools) + invite CTA + testimonials
5. **Overview analytics charts** — chart للاعبين عبر الوقت من PlayerHistory model

## المرحلة 3 (التصميم):
- shared.css v5: داكن أعمق #03050a/#060a16، glow أزرق-برتقالي subtle، spacing أكبر (للقضاء على الاكتضاض)، cards أعمق مع border subtle
- typography أكبر قليلًا، headers بـ gradient
- charts (Chart.js) في overview

## بنية مهمة:
- local-dev: LOCAL_DEV=1 SESSION_SECRET='local-dev-secret' node local-dev.js (port 3999)، GET /__dev-create للـ session
- Railway ينشر من main تلقائيًا
- owner ID: 804999528129363998، guild: 1059183076636372993
