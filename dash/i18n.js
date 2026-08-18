/**
 * ProMcBot — Internationalization (i18n)
 * Languages: English (default), Arabic (RTL), Spanish
 * Persistence: cookie `pmc_lang` (survives all pages) + localStorage fallback
 * Usage: elements use `data-i18n="key"` for text and `data-i18n-placeholder="key"` for inputs.
 */
(function () {
  'use strict';

  const SUPPORTED = ['en', 'ar', 'es'];
  const COOKIE = 'pmc_lang';
  const LSKEY = 'pmc_lang';

  // ──────────────────────────────────────────────────────────────
  // COOKIE helpers (visible on every page, same domain)
  // ──────────────────────────────────────────────────────────────
  function setLangCookie(lang) {
    try {
      document.cookie = `${COOKIE}=${lang};path=/;max-age=31536000;SameSite=Lax`;
    } catch (_) {}
  }
  function getLangCookie() {
    try {
      const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([a-z]{2})`));
      return m ? m[1] : null;
    } catch (_) { return null; }
  }

  // ──────────────────────────────────────────────────────────────
  // Translation dictionaries
  // ──────────────────────────────────────────────────────────────
  const DICT = {
    // ── Sidebar
    'sb.overview':      { en: 'Overview', ar: 'نظرة عامة', es: 'Resumen' },
    'sb.configuration': { en: 'Configuration', ar: 'الإعدادات', es: 'Configuración' },
    'sb.modules':       { en: 'Modules', ar: 'الوحدات', es: 'Módulos' },
    'sb.moderation':    { en: 'Moderation', ar: 'الإشراف', es: 'Moderación' },
    'sb.roles':         { en: 'Roles', ar: 'الرتب', es: 'Roles' },
    'sb.logs':          { en: 'Logs', ar: 'السجلات', es: 'Registros' },
    'sb.auto_responder':{ en: 'Auto Responder', ar: 'الرد التلقائي', es: 'Respuesta Automática' },
    'sb.tickets':       { en: 'Tickets', ar: 'التذاكر', es: 'Tickets' },
    'sb.welcome':       { en: 'Welcome', ar: 'الترحيب', es: 'Bienvenida' },
    'sb.players':       { en: 'MC Players', ar: 'لاعبين MC', es: 'Jugadores MC' },
    'sb.website':       { en: 'Website', ar: 'الموقع', es: 'Sitio Web' },
    'sb.settings':      { en: 'Settings', ar: 'إعدادات', es: 'Ajustes' },
    'sb.members':       { en: 'Members', ar: 'الأعضاء', es: 'Miembros' },
    'sb.danger':        { en: 'Danger Zone', ar: 'منطقة الخطر', es: 'Zona Peligrosa' },
    'sb.back_servers':  { en: 'Back to Servers', ar: 'العودة للسيرفرات', es: 'Volver a Servidores' },
    'sb.admin_overview':{ en: 'Overview', ar: 'نظرة عامة', es: 'Resumen' },
    'sb.statistics':    { en: 'Statistics', ar: 'إحصائيات', es: 'Estadísticas' },
    'sb.users':         { en: 'Users', ar: 'المستخدمون', es: 'Usuarios' },
    'sb.send_email':    { en: 'Send Email', ar: 'إرسال بريد', es: 'Enviar Email' },
    'sb.send_embed':    { en: 'Send Embed', ar: 'إرسال Embed', es: 'Enviar Embed' },
    'sb.bug_reports':   { en: 'Bug Reports', ar: 'تقارير الأخطاء', es: 'Reportes' },
    'sb.label_server':  { en: 'Server', ar: 'السيرفر', es: 'Servidor' },
    'sb.label_moderation':{ en: 'Moderation', ar: 'الإشراف', es: 'Moderación' },
    'sb.label_features':  { en: 'Features', ar: 'المميزات', es: 'Funciones' },
    'sb.label_management':{ en: 'Management', ar: 'الإدارة', es: 'Gestión' },
    'sb.label_account': { en: 'Account', ar: 'الحساب', es: 'Cuenta' },
    'sb.label_navigation':{ en: 'Navigation', ar: 'التنقل', es: 'Navegación' },

    // ── Navbar / layout
    'nav.dashboard':      { en: 'Dashboard', ar: 'لوحة التحكم', es: 'Panel' },
    'nav.my_servers':     { en: 'My Servers', ar: 'سيرفراتي', es: 'Mis Servidores' },
    'nav.profile':        { en: 'Profile', ar: 'الملف الشخصي', es: 'Perfil' },
    'nav.logout':         { en: 'Logout', ar: 'تسجيل الخروج', es: 'Cerrar sesión' },
    'nav.language':       { en: 'Language', ar: 'اللغة', es: 'Idioma' },
    'nav.admin':          { en: 'Admin Panel', ar: 'لوحة الإدارة', es: 'Panel Admin' },
    'nav.my_space':       { en: 'My Space', ar: 'مساحتي', es: 'Mi Espacio' },
    'nav.notification':   { en: 'Notifications', ar: 'الإشعارات', es: 'Notificaciones' },
    'nav.no_notif':       { en: 'You have no new notifications.', ar: 'لا توجد إشعارات جديدة.', es: 'No tienes notificaciones nuevas.' },
    'nav.notif_header':   { en: 'Welcome to ProMcBot!', ar: 'مرحبًا بك في ProMcBot!', es: '¡Bienvenido a ProMcBot!' },
    'nav.my_account':     { en: 'My Account', ar: 'حسابي', es: 'Mi Cuenta' },
    'nav.my_profile':     { en: 'My Profile', ar: 'ملفي الشخصي', es: 'Mi Perfil' },
    'nav.collapse':       { en: 'Collapse', ar: 'طي', es: 'Contraer' },

    // ── User profile page
    'up.profile':         { en: 'User Profile', ar: 'الملف الشخصي', es: 'Perfil de Usuario' },
    'up.loading':         { en: 'Loading profile…', ar: 'جارٍ تحميل البروفايل…', es: 'Cargando perfil…' },
    'up.not_found_sub':   { en: 'This Discord account could not be resolved.', ar: 'تعذر الوصول إلى هذا الحساب.', es: 'No se pudo resolver esta cuenta.' },
    'up.follow':          { en: 'Follow', ar: 'متابعة', es: 'Seguir' },
    'up.unfollow':        { en: 'Unfollow', ar: 'إلغاء المتابعة', es: 'Dejar de seguir' },
    'up.followers':       { en: 'Followers', ar: 'متابعون', es: 'Seguidores' },
    'up.following':       { en: 'Following', ar: 'يتابع', es: 'Siguiendo' },
    'up.status':          { en: 'Status', ar: 'الحالة', es: 'Estado' },
    'up.not_found':       { en: 'User not found', ar: 'المستخدم غير موجود', es: 'Usuario no encontrado' },
    'up.view_dashboard':  { en: 'Visit ProMcBot Dashboard', ar: 'زيارة داشبورد ProMcBot', es: 'Visitar el Panel de ProMcBot' },

    // ── Home / landing
    'home.badge':           { en: 'Advanced Minecraft & Discord Integration Engine', ar: 'محرك تكامل متقدم لماين كرافت وديسكورد', es: 'Motor Avanzado de Integración Minecraft & Discord' },
    'home.hero_title_h1':   { en: 'Link your Discord & Minecraft servers seamlessly', ar: 'اربط سيرفراتك ديسكورد وماين كرافت بسهولة تامة', es: 'Conecta tus servidores Discord & Minecraft sin problemas' },
    'home.hero_start':      { en: 'Get Started — It\u2019s Free', ar: 'ابدأ الآن — مجاني', es: 'Comenzar — Es Gratis' },
    'home.hero_explore':    { en: 'Explore Features', ar: 'استكشف المميزات', es: 'Explorar Funciones' },
    'home.s_bridge':        { en: 'Bridge Status', ar: 'حالة الجسر', es: 'Estado del Puente' },
    'home.s_synced':        { en: 'Fully Synchronized', ar: 'متزامن بالكامل', es: 'Totalmente Sincronizado' },
    'home.s_players':       { en: 'Connected Players', ar: 'لاعبون متصلون', es: 'Jugadores Conectados' },
    'home.s_active':        { en: 'Active Now', ar: 'نشط الآن', es: 'Activos Ahora' },
    'home.s_anticrash':     { en: 'Anti-Crash Protection', ar: 'حماية ضد الانهيار', es: 'Protección Anti-Crash' },
    'home.s_active_label':  { en: 'Active', ar: 'نشط', es: 'Activo' },
    'home.users':           { en: 'Registered Users', ar: 'مستخدم مسجل', es: 'Usuarios Registrados' },
    'home.uptime':          { en: 'Server Uptime', ar: 'تشغيل السيرفر', es: 'Tiempo de Actividad' },
    'home.core_access':     { en: 'Core Access', ar: 'الوصول الأساسي', es: 'Acceso Básico' },
    'home.features_title':  { en: 'Everything you need to master your community', ar: 'كل ما تحتاجه لإدارة مجتمعك باحتراف', es: 'Todo lo que necesitas para dominar tu comunidad' },
    'home.f1_title':        { en: 'Discord ↔ Minecraft Bridge', ar: 'جسر ديسكورد ↔ ماين كرافت', es: 'Puente Discord ↔ Minecraft' },
    'home.f1_desc':         { en: 'Sync chat messages, commands, and console logs between Discord channels and Minecraft server chat in real-time with zero latency.', ar: 'مزامنة الرسائل والأوامر وسجلات الكونسول بين قنوات ديسكورد ودردشة سيرفر ماين كرافت في الوقت الحقيقي.', es: 'Sincroniza chats, comandos y consolas entre Discord y Minecraft en tiempo real.' },
    'home.f2_title':        { en: 'Live Server Status & Ping', ar: 'حالة السيرفر الحية', es: 'Estado del Servidor en Vivo' },
    'home.f2_desc':         { en: 'Monitor player counts, TPS, RAM usage, and MOTD updates directly from rich embeds in your Discord channels.', ar: 'راقب عدد اللاعبين وTPS واستخدام الذاكرة مباشرة من embeds غنية في قنواتك.', es: 'Monitorea jugadores, TPS, RAM y MOTD directamente desde embeds en tus canales.' },
    'home.f3_title':        { en: 'Advanced Moderation & Anti-Crash', ar: 'إشراف متقدم وحماية ضد الانهيار', es: 'Moderación Avanzada y Anti-Crash' },
    'home.f3_desc':         { en: 'Protect your network with bulletproof anti-crash modules, automated bans, mutes, and unified moderation logs.', ar: 'احمِ شبكتك بوحدات حماية موثوقة وحظر تلقائي وكتم وسجلات إشراف موحدة.', es: 'Protege tu red con módulos anti-crash, baneos automáticos y registros unificados.' },
    'home.f4_title':        { en: 'Smart Auto Responder', ar: 'الرد التلقائي الذكي', es: 'Respuesta Automática Inteligente' },
    'home.f4_desc':         { en: 'Create custom automated responses, triggers, and keyword hooks to keep your community engaged 24/7 without manual intervention.', ar: 'أنشئ ردودًا آلية مخصصة ومحفزات وخطافات كلمات مفتاحية لإبقاء مجتمعك نشطًا على مدار الساعة.', es: 'Crea respuestas automáticas personalizadas y mantén tu comunidad activa 24/7.' },
    'home.f5_title':        { en: 'Automated Store & Ranks', ar: 'المتجر والرتب الآلي', es: 'Tienda y Rangos Automáticos' },
    'home.f5_desc':         { en: 'Reward your donors and members with automatic role syncing, permission updates, and Minecraft in-game perks.', ar: 'كافئ المتبرعين والأعضاء بمزامنة تلقائية للأدوار وتحديث الصلاحيات ومزايا داخل اللعبة.', es: 'Recompensa a donantes y miembros con sincronización automática de roles y permisos.' },
    'home.f6_title':        { en: 'Elite Analytics Dashboard', ar: 'لوحة تحليلات احترافية', es: 'Panel de Análisis Elite' },
    'home.f6_desc':         { en: 'Gain deep insights into server activity, engagement trends, and player retention with our high-performance control panel.', ar: 'احصل على رؤى عميقة حول نشاط السيرفر واتجاهات التفاعل والاحتفاظ باللاعبين.', es: 'Obtén insights profundos sobre actividad del servidor, tendencias y retención de jugadores.' },
    'home.faq_title':       { en: 'Frequently Asked Questions', ar: 'الأسئلة الشائعة', es: 'Preguntas Frecuentes' },
    'home.faq_sub':         { en: 'Got questions? We\u2019ve got answers.', ar: 'عندك أسئلة؟ عندنا الإجابات.', es: '¿Tienes preguntas? Tenemos respuestas.' },
    'home.faq1_q':          { en: 'What is ProMcBot?', ar: 'ما هو ProMcBot؟', es: '¿Qué es ProMcBot?' },
    'home.faq1_a':          { en: 'ProMcBot is a Discord bot that links Discord servers with Minecraft servers for effortless control, automation, and community management.', ar: 'ProMcBot هو بوت ديسكورد يربط سيرفرات ديسكورد بسيرفرات ماين كرافت للتحكم والأتمتة وإدارة المجتمع.', es: 'ProMcBot es un bot de Discord que conecta servidores de Discord con servidores de Minecraft.' },
    'home.faq2_q':          { en: 'How do I connect my server?', ar: 'كيف أربط سيرفري؟', es: '¿Cómo conecto mi servidor?' },
    'home.faq2_a':          { en: 'Invite ProMcBot to your Discord, run the /setup_server command, and follow the prompts to authorize your Minecraft server via our plugin.', ar: 'ادعُ ProMcBot إلى ديسكوردك، شغّل الأمر /setup_server، واتبع الخطوات لتفويض سيرفر ماين كرافت عبر الإضاف.', es: 'Invita a ProMcBot, ejecuta /setup_server y sigue los pasos para autorizar tu servidor.' },
    'home.faq3_q':          { en: 'Is it free?', ar: 'هل هو مجاني؟', es: '¿Es gratis?' },
    'home.faq3_a':          { en: 'Yes — ProMcBot\u2019s core features are completely free. Premium plans are available for advanced features and priority support.', ar: 'نعم — المميزات الأساسية مجانية بالكامل. توجد خطط بريميوم للميزات المتقدمة والدعم الأولوي.', es: 'Sí — las funciones principales son totalmente gratis. Los planes Premium añaden funciones avanzadas.' },
    'home.faq4_q':          { en: 'Which Minecraft versions are supported?', ar: 'ما إصدارات ماين كرافت المدعومة؟', es: '¿Qué versiones de Minecraft son compatibles?' },
    'home.faq4_a':          { en: 'ProMcBot supports both Java Edition and Bedrock Edition servers. Our plugin is compatible with popular server softwares like Paper, Spigot, and Velocity.', ar: 'ProMcBot يدعم إصداري Java وBedrock. الإضاف متوافق مع Paper وSpigot وVelocity.', es: 'Soporta Java y Bedrock. Nuestro plugin es compatible con Paper, Spigot y Velocity.' },
    'home.faq5_q':          { en: 'Is my data secure?', ar: 'هل بياناتي آمنة؟', es: '¿Mis datos están seguros?' },
    'home.faq5_a':          { en: 'Absolutely. We follow industry best practices for data security. Read our Privacy Policy for details.', ar: 'بالتأكيد. نتبع أفضل ممارسات أمان البيانات. اقرأ سياسة الخصوصية للتفاصيل.', es: 'Absolutamente. Seguimos las mejores prácticas de seguridad de datos. Lee nuestra Política de Privacidad.' },
    'home.cta_title':       { en: 'Ready to supercharge your Minecraft community?', ar: 'جاهز لتنشيط مجتمع ماين كرافت؟', es: '¿Listo para potenciar tu comunidad de Minecraft?' },
    'home.cta_sub':         { en: 'Join thousands of servers already using ProMcBot to manage and automate their worlds.', ar: 'انضم لآلاف السيرفرات التي تستخدم ProMcBot لإدارة عالمها وأتمتتها.', es: 'Únete a miles de servidores que ya usan ProMcBot para automatizar sus mundos.' },
    'home.cta_btn':         { en: 'Get Started for Free', ar: 'ابدأ مجانًا', es: 'Comenzar Gratis' },
    'home.footer_tag':      { en: 'All rights reserved.', ar: 'جميع الحقوق محفوظة.', es: 'Todos los derechos reservados.' },
    'home.cookie_text':     { en: 'We use cookies to enhance your experience.', ar: 'نستخدم الكوكيز لتحسين تجربتك.', es: 'Usamos cookies para mejorar tu experiencia.' },
    'home.cookie_accept':   { en: 'Accept', ar: 'قبول', es: 'Aceptar' },

    'home.hero_title':    { en: 'The Ultimate Control Center for Minecraft Servers', ar: 'مركز التحكم الشامل لسيرفرات ماين كرافت', es: 'El Centro de Control Definitivo para Servidores de Minecraft' },
    'home.hero_subtitle': { en: 'Manage your Discord server & Minecraft network from one beautiful dashboard — moderation, ranks, tickets, auto-responder, player stats & more.', ar: 'أدر سيرفر الديسكورد وشبكة ماين كرافت من لوحة واحدة جميلة — إشراف، رتب، تذاكر، رد تلقائي، إحصائيات اللاعبين والمزيد.', es: 'Gestiona tu servidor de Discord y red de Minecraft desde un panel hermoso — moderación, rangos, tickets, respuestas automáticas, estadísticas de jugadores y más.' },
    'home.btn_add':       { en: 'Add to Discord', ar: 'أضف إلى ديسكورد', es: 'Añadir a Discord' },
    'home.btn_login':     { en: 'Open Dashboard', ar: 'افتح الداشبورد', es: 'Abrir Panel' },
    'home.features':      { en: 'Features', ar: 'المميزات', es: 'Funciones' },
    'home.features_sub':  { en: 'Everything a Minecraft network owner needs', ar: 'كل ما يحتاجه مالك شبكة ماين كرافت', es: 'Todo lo que necesita un dueño de red de Minecraft' },
    'home.f1_title':      { en: 'Moderation & Protection', ar: 'الإشراف والحماية', es: 'Moderación y Protección' },
    'home.f1_desc':       { en: 'Auto-moderation, anti-raid, temp-bans, warnings and a full audit log keep your server safe around the clock.', ar: 'إشراف آلي ومكافحة غارات وحظر مؤقت وتحذيرات وسجل تدقيق كامل يبقي سيرفرك آمنًا على مدار الساعة.', es: 'La auto-moderación, anti-raid, baneos temporales, advertencias y un registro de auditoría completo mantienen tu servidor seguro.' },
    'home.f2_title':      { en: 'Rank & Welcome System', ar: 'نظام الرتب والترحيب', es: 'Sistema de Rangos y Bienvenida' },
    'home.f2_desc':       { en: 'Give ranks automatically by rules, reactions or invite codes, and greet new members with custom messages and images.', ar: 'امنح الرتب تلقائيًا حسب القواعد أو الرياكشنات أو أكواد الدعوات، ورحّب بالأعضاء برسائل وصور مخصصة.', es: 'Otorga rangos automáticamente por reglas, reacciones o códigos de invitación, y da la bienvenida con mensajes e imágenes personalizados.' },
    'home.f3_title':      { en: 'Tickets & Auto-Responder', ar: 'التذاكر والرد التلقائي', es: 'Tickets y Respuestas Automáticas' },
    'home.f3_desc':       { en: 'A full support ticket system with transcripts, plus smart auto-replies to common questions.', ar: 'نظام تذاكر دعم كامل مع سجلات المحادثات، بالإضافة إلى ردود آلية ذكية على الأسئلة الشائعة.', es: 'Un sistema completo de tickets de soporte con transcripciones, más respuestas automáticas inteligentes.' },
    'home.f4_title':      { en: 'Server Website Builder', ar: 'منشئ موقع السيرفر', es: 'Constructor de Sitios Web' },
    'home.f4_desc':       { en: 'Launch a beautiful public website for your Minecraft server with live leaderboard, news, custom domains & subdomains.', ar: 'أطلق موقعًا عامًا جميلًا لسيرفر ماين كرافت مع جدول صدارة حي وأخبار ودومينات مخصصة.', es: 'Lanza un sitio web público hermoso para tu servidor con ranking en vivo, noticias y dominios personalizados.' },
    'home.f5_title':      { en: 'MC Players & Stats', ar: 'اللاعبون والإحصائيات', es: 'Jugadores y Estadísticas' },
    'home.f5_desc':       { en: 'Look up any player by name, see their full history, sessions, playtime and leaderboard rankings.', ar: 'ابحث عن أي لاعب بالاسم واعرض تاريخه الكامل وجلسات اللعب ووقت اللعب وترتيبه في الصدارة.', es: 'Busca cualquier jugador por nombre y ve su historial completo, sesiones, tiempo de juego y ranking.' },
    'home.f6_title':      { en: 'Notifications & Admin', ar: 'الإشعارات والإدارة', es: 'Notificaciones y Administración' },
    'home.f6_desc':       { en: 'Send notifications to one user or everyone, track bug reports, and control everything from a powerful admin panel.', ar: 'أرسل إشعارات لمستخدم واحد أو الجميع، تابع تقارير الأخطاء، وتحكم في كل شيء من لوحة إدارة قوية.', es: 'Envía notificaciones a un usuario o a todos, sigue reportes de errores y controla todo desde un panel de administración.' },
    'home.stats':         { en: 'Live Stats', ar: 'إحصائيات حية', es: 'Estadísticas en Vivo' },
    'home.servers':       { en: 'Connected Servers', ar: 'سيرفر متصل', es: 'Servidores Conectados' },
    'home.secure':        { en: 'Secure & Private', ar: 'آمن وخاص', es: 'Seguro y Privado' },
    'home.secure_desc':   { en: 'Your settings are encrypted at rest, all API routes are permission-checked, and nothing is ever shared.', ar: 'إعداداتك مشفرة في التخزين، وكل مسارات API تخضع لفحص الصلاحيات، ولا شيء يُشارك أبدًا.', es: 'Tus ajustes están cifrados, todas las rutas de API verifican permisos y nada se comparte jamás.' },

    // ── Website builder
    'web.title':          { en: 'Server Website Builder', ar: 'منشئ موقع السيرفر', es: 'Constructor de Sitio Web' },
    'web.subtitle':       { en: 'Build a full website for your Minecraft server with leaderboard, live stats & templates.', ar: 'ابنِ موقعًا كاملًا لسيرفر ماين كرافت مع جدول الصدارة والإحصائيات الحية والقوالب.', es: 'Crea un sitio web completo para tu servidor con ranking, estadísticas y plantillas.' },
    'web.public':         { en: 'Your public website', ar: 'موقعك العام', es: 'Tu sitio público' },
    'web.copy':           { en: 'Copy', ar: 'نسخ', es: 'Copiar' },
    'web.open_site':      { en: 'Open Site', ar: 'فتح الموقع', es: 'Abrir Sitio' },
    'web.saved_live':     { en: 'Saved & LIVE', ar: 'محفوظ ونشط', es: 'Guardado y ACTIVO' },
    'web.saved_off':      { en: 'Saved (OFF)', ar: 'محفوظ (معطّل)', es: 'Guardado (OFF)' },
    'web.tab_general':    { en: 'General', ar: 'عام', es: 'General' },
    'web.tab_minecraft':  { en: 'Minecraft Info', ar: 'معلومات ماين كرافت', es: 'Info de Minecraft' },
    'web.tab_branding':   { en: 'Branding', ar: 'الهوية', es: 'Marca' },
    'web.tab_templates':  { en: 'Templates', ar: 'القوالب', es: 'Plantillas' },
    'web.tab_sections':   { en: 'Sections', ar: 'الأقسام', es: 'Secciones' },
    'web.tab_news':       { en: 'News (Advanced)', ar: 'الأخبار (متقدم)', es: 'Noticias (Avanzado)' },
    'web.tab_socials':    { en: 'Socials', ar: 'الشبكات', es: 'Redes' },
    'web.tab_domain':     { en: 'Domain', ar: 'الدومين', es: 'Dominio' },
    'web.tab_preview':    { en: 'Live Preview', ar: 'معاينة حية', es: 'Vista Previa' },
    'web.save':           { en: 'Save Changes', ar: 'حفظ التغييرات', es: 'Guardar Cambios' },
    'web.discard':        { en: 'Discard', ar: 'إلغاء', es: 'Descartar' },
    'web.saved_ok':       { en: 'Website saved!', ar: 'تم حفظ الموقع!', es: '¡Sitio web guardado!' },
    'web.live_at':        { en: 'Your site updates live at', ar: 'موقعك يتحدث مباشرة على', es: 'Tu sitio se actualiza en vivo en' },
    'web.preview_label':  { en: 'Live preview of your published site (updates after you save & refresh):', ar: 'معاينة حية لموقعك المنشور (تتحدث بعد الحفظ والتحديث):', es: 'Vista previa en vivo de tu sitio publicado (se actualiza al guardar y refrescar):' },

    // ── Overview
    'ov.loading':         { en: 'Loading server data…', ar: 'جارٍ تحميل بيانات السيرفر…', es: 'Cargando datos del servidor…' },
    'ov.no_activity':     { en: 'No recent activity yet', ar: 'لا يوجد نشاط حديث بعد', es: 'Aún no hay actividad reciente' },
    'ov.bot_missing':     { en: 'Bot not in server — use /invite to add the bot', ar: 'البوت غير موجود في السيرفر — استخدم /invite لإضافته', es: 'El bot no está en el servidor — usa /invite para añadirlo' },

    // ── Site offline page
    'so.title':           { en: 'This site is offline', ar: 'هذا الموقع غير نشط', es: 'Este sitio está sin conexión' },
    'so.body':            { en: 'The server owner has not enabled their website yet, or the server does not exist.', ar: 'مالك السيرفر لم يفعّل موقعه بعد، أو أن السيرفر غير موجود.', es: 'El dueño del servidor aún no habilitó su sitio, o el servidor no existe.' },
    'so.visit':           { en: 'Visit ProMcBot', ar: 'زيارة ProMcBot', es: 'Visitar ProMcBot' },

    // ── User profile /u/:id
    'up.joined':          { en: 'Joined ProMcBot', ar: 'انضم إلى ProMcBot', es: 'Se unió a ProMcBot' },
    'up.servers':         { en: 'Connected Servers', ar: 'السيرفرات المتصلة', es: 'Servidores Conectados' },
    'up.follow':          { en: 'Follow', ar: 'متابعة', es: 'Seguir' },
    'up.unfollow':        { en: 'Unfollow', ar: 'إلغاء المتابعة', es: 'Dejar de seguir' },
    'up.followers':       { en: 'Followers', ar: 'المتابعون', es: 'Seguidores' },
    'up.following':       { en: 'Following', ar: 'يتابع', es: 'Siguiendo' },
    'up.own':             { en: 'This is your profile', ar: 'هذا هو ملفك الشخصي', es: 'Este es tu perfil' },
    'up.login_first':     { en: 'Log in to follow users', ar: 'سجّل الدخول لمتابعة المستخدمين', es: 'Inicia sesión para seguir usuarios' },
    'up.followed':        { en: 'You are now following', ar: 'أنت الآن تتابع', es: 'Ahora sigues a' },
    'up.unfollowed':      { en: 'Unfollowed', ar: 'تم إلغاء المتابعة', es: 'Dejaste de seguir' },

    // ── Misc
    'misc.loading':       { en: 'Loading…', ar: 'جارٍ التحميل…', es: 'Cargando…' },
    'misc.error':         { en: 'Something went wrong', ar: 'حدث خطأ', es: 'Algo salió mal' },
    'misc.success':       { en: 'Success', ar: 'تم بنجاح', es: 'Éxito' },
    'misc.confirm':       { en: 'Confirm', ar: 'تأكيد', es: 'Confirmar' },
    'misc.cancel':        { en: 'Cancel', ar: 'إلغاء', es: 'Cancelar' },
  };

  function get(key) {
    const lang = window.__pmc_lang || 'en';
    const entry = DICT[key];
    if (!entry) return null;
    return (entry[lang] ?? entry.en).replace(/\\n/g, ' ').replace(/\\u2019/g, '’').replace(/\\u2018/g, '‘');
  }

  function applyTranslations(root) {
    const lang = window.__pmc_lang || 'en';
    const container = root || document;
    container.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const txt = get(key);
      if (txt !== null) el.textContent = txt; // keep simple; get() no longer emits <br>
    });
    container.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const txt = get(key);
      if (txt !== null) el.placeholder = txt;
    });
    // RTL handling: document-level only (dashboard & public pages are full-page)
    if (lang === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', lang);
    }
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return;
    window.__pmc_lang = lang;
    try { localStorage.setItem(LSKEY, lang); } catch (_) {}
    setLangCookie(lang);
    applyTranslations();
    // Update language selector UI if present (any .lang-select* element)
    document.querySelectorAll('.lang-select, .lang-select-home').forEach(sel => {
      sel.querySelectorAll('option').forEach(opt => {
        opt.selected = opt.value === lang;
      });
    });
  }

  function initLanguage() {
    let lang = null;
    try { lang = localStorage.getItem(LSKEY); } catch (_) {}
    if (!lang) lang = getLangCookie();
    if (!lang || !SUPPORTED.includes(lang)) lang = 'en';
    window.__pmc_lang = lang;
  }

  // Expose globally so any page can hook in
  window.__pmc_i18n = {
    SUPPORTED, DICT,
    get, setLanguage, applyTranslations, initLanguage,
    getLangCookie, setLangCookie,
  };
})();
