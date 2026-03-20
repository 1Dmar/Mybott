# 👑 ProMcBot | Minecraft Royal Passport & Watcher

هذا التحديث هو الأضخم والأفخم لخدمة مجتمع ماين كرافت، مع التركيز الكامل على تفعيل **Message Content Intent** عبر نظام "جواز سفر الخادم" التلقائي.

## ✨ الميزات الجديدة (التحديث الملكي الأسطوري)

1.  **Minecraft Royal Passport (تلقائي - يحتاج للـ Intent):**
    *   بمجرد ذكر أي عنوان IP لخادم ماين كرافت في المحادثة، يقوم البوت تلقائياً بتحويله إلى "جواز سفر ملكي" (Embed فخم).
    *   يحتوي الجواز على: اسم الخادم، عدد اللاعبين، الإصدار، وصف الخادم (MOTD)، وصورة حية للـ Ping.
    *   **لماذا هذا مطلوب للتوثيق؟** لأنه يثبت أن البوت يقدم ميزة تفاعلية فورية (Automation) تعتمد على محتوى الرسائل لتحسين تجربة المستخدمين.

2.  **أمر `!mc` الملكي (Message Command):**
    *   تمت إعادة الأمر كأمر رسائل تقليدي كما كان (`!mc`) ولكن بتصميم ملكي جديد كلياً.
    *   يعرض كافة تفاصيل الخادم بتنسيق ذهبي فاخر مع أزرار تفاعلية.
    *   يدعم جلب بيانات السيرفر الافتراضي من قاعدة البيانات في حال عدم تحديد IP.

3.  **التحكم الكامل (MongoDB Control):**
    *   يمكن لأصحاب السيرفرات تشغيل أو إيقاف ميزة "جواز السفر التلقائي" عبر الأمر `/toggle-watcher`.
    *   الإعدادات تُحفظ في قاعدة البيانات **MongoDB** لضمان الخصوصية والتحكم.

---

## 📝 ماذا تكتب في طلب التوثيق (Verification Description)؟

> **English Version (Recommended for Discord):**
> "ProMcBot introduces the 'Minecraft Royal Passport' system, a sophisticated automation feature designed to enhance the gaming experience. When users share Minecraft server IP addresses in chat, the bot automatically intercepts the message and generates a 'Royal Passport'—a high-end, information-rich visual card displaying real-time server statistics (players, version, MOTD, and ping). This automation eliminates the need for manual commands, providing immediate value to both server owners and players. To achieve this seamless integration, the bot requires the 'Message Content Intent' to scan for IP patterns. Furthermore, this feature is optional and can be toggled by server administrators via the `/toggle-watcher` command, with settings persisted in our MongoDB database."

---

## 🛠️ الملفات المضافة والمحدثة في فرع `hi`:
*   `bot/Commands/Message/Misc/mc.js`: أمر `!mc` الملكي الجديد.
*   `bot/events/MinecraftWatcher.js`: نظام "جواز السفر" التلقائي (الـ Intent).
*   `bot/Commands/Slash/Misc/toggle-watcher.js`: أمر التحكم (Toggle).
*   `bot/Models/Server.js`: تحديث نموذج البيانات.
*   `README_DOC.md`: دليل الاستخدام والتوثيق.
