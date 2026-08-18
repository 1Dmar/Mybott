# الجلسة الجديدة — قائمة المهام (من طلب المستخدم بالصور)

## التشخيص الجذري
- الموقع الحي ينشر من main ✓ (deployTime 11:08Z، uptime حي)
- الصور التي أرسلها المستخدم التقطت **قبل** نشر dfed20dd — الصفحة كانت فاتحة (old template) لأن التصميم الجديد فُتح أول مرة بـtheme=light أو الكاش قديم
- لكن الأهم: **التصميم الجديد يجب أن يكون الافتراضي داكن فاخر للجميع** — لا نريد أن يرى أحد التصميم الفاتح القديم أبدًا
- shared.css الحالي: blue/light (v3.0) + body.dark داكن عادي. يجب تحويله لـpremium dark design

## مهام المستخدم
1. التصميم الفاخر الجديد على **جميع** صفحات الداشبورد (premium dark: #05070d + orange glow #FF512F/#F09819 + glass + starfield خفيف)
2. صفحة /docs كاملة للمشروع (API، بوت، إضاف، أوامر، تكامل MongoDB)
3. زر Save في صفحة Website — يتفعل الموقع (فحص website.html JS)
4. إصلاح /settings بلا CSS (settings.html لم يكن يستخدم shared.css? — تأكد: grep أظهر shared.css:1 — لكن المستخدم يقول لا CSS. غالبًا style inline قديم يغطي)
5. إصلاح navbar وoverview responsive
6. إصلاح server discovery و server check (فحص: كيف تُكتشف السيرفرات في dashboard)
7. أفكار جديدة قوية
8. الأفضل: التفوق على vetox.io/ar

## خطوات التنفيذ
- [ ] تحديث shared.css: default dark premium (نقل tokens من home.html) + light mode كخيار toggle
- [ ] إضافة starfield خفيف + glow + floating cubes للـdashboard body
- [ ] فحص website.html: زر save وعملية النشر
- [ ] فحص servers.html (server discovery) وserver check
- [ ] صفحة docs.html + route /docs
- [ ] أفكار: particle background، ترحيب متحرك، stats حية، Minecraft font للعناوين، hover animations، progress bars، toast notifications، command palette؟

## ألوان التصميم الفاخر (من home.html)
```
--primary: #FF512F; --primary-2: #F09819;
--bg: #05070d; --bg-2: #0a0f1c;
--surface: rgba(255,255,255,0.04); --surface-2: rgba(255,255,255,0.07);
--border: rgba(255,255,255,0.08); --border-hi: rgba(255,120,60,0.35);
--text: #e9edf5; --text-secondary: #93a3bd; --text-muted: #5d6b82;
--glow-orange: rgba(255,107,47,0.55); --glow-blue: rgba(64,112,244,0.35);
```

## حالة الرفع
- آخر commit على main: dfed20dd (مرفوع ونُشر)
- ملاحظات: لا تلمس copilot branch. النشر تلقائي من main على Railway.
