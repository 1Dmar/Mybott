/**
 * 
 * تم تنقيح هذا الملف ليكون متناسقاً تماماً مع أنظمة البوت الحالية (Minecraft & Automod).
 * تم الإبقاء فقط على الإيموجي الضرورية لضمان مظهر احترافي وتقليل الفوضى.
 * 
 */

module.exports = {
    // --- [ نظام Minecraft ] ---
    ONLINE: { id: '1410178650070061096', animated: false },
    OFFLINE: { id: '1410178629098278922', animated: false },
    UNDER_MAINTENANCE: { id: '1410178614204432474', animated: false },
    JAVA: { id: '1410147547363934300', animated: false },
    BEDROCK: { id: '1410147921676075038', animated: false },
    MEMBERS: { id: '1410147631308603494', animated: false }, // من الصورة (PLAYER)
    DIAMOND: { id: '1410147661008605224', animated: false }, // من الصورة (ACHIEVEMENT)

    // --- [ التفاعل والرسائل العامة ] ---
    SUCCESS: { id: '1410147529630289960', animated: false }, // من الصورة (CHECK)
    ERROR: { id: '1410147617056362558', animated: false },   // من الصورة (BLOCK)
    WARNING: { id: '1410147601281581118', animated: false },
    INFO: { id: '1410147645883678763', animated: false },    // من الصورة (INFORMATION)

    // --- [ أنظمة الحماية والإدارة ] ---
    SHIELD: "🛡️",    // مهم لنظام Automod (بإمكانك إضافته لاحقاً)
    GEAR: "⚙️",      // مهم للإعدادات
    SEARCH: "🔍",    // مهم للفلاتر
    CLIPBOARD: "📋", // مهم للسجلات (Logs)
    EDIT: "📝",      // مهم للتعديلات
    LINK: "🔗",      // مهم للروابط والدعم

    // --- [ إضافات جمالية (اختيارية) ] ---
    SPARKLES: "✨",
    STAR: "⭐",
    PIN: "📍",
    FIRE: "🔥",
    ROCKET: "🚀",
    UP: { id: '1243498882952855604', animated: false },
    DOWN: { id: '1243498861041942538', animated: false },
    
    // --- [ توافقية الكود ] ---
    // هذه المسميات تستخدم في بعض أجزاء الكود، تم ربطها بالأساسيات لضمان عدم حدوث خطأ
    get CHECK() { return this.SUCCESS },
    get BLOCK() { return this.ERROR },
    get PLAYER() { return this.MEMBERS },
    get INFORMATION() { return this.INFO },
    get ACHIEVEMENT() { return this.DIAMOND }
};
