# 👑 ProMcBot | Minecraft Royal Watcher & Analytics

هذا التحديث يركز على تقديم تجربة مستخدم فخمة جداً مع تحكم كامل لأصحاب السيرفرات عبر قاعدة البيانات **MongoDB**، مع ضمان قبول توثيق البوت.

## ✨ الميزات المطورة (التحديث الملكي الفاخر)

1.  **Minecraft Auto-Watcher (التحكم الكامل):**
    *   البوت يكتشف عناوين IP خوادم ماين كرافت في الرسائل ويظهر حالتها تلقائياً.
    *   **جديد:** يمكن لأصحاب السيرفرات تشغيل أو إطفاء هذه الميزة عبر الأمر `/toggle-watcher` لتجنب أي مشاكل مع القوانين الخاصة بكل سيرفر.
    *   الحالة تُحفظ في قاعدة البيانات **MongoDB** لكل سيرفر بشكل مستقل.

2.  **أمر `/mc` المطور:**
    *   تم إعادة تصميم أمر `/mc` بالكامل ليكون **ملكياً فخماً**.
    *   يعرض إحصائيات دقيقة، وصف الخادم، وصورة الـ Ping، مع أزرار تفاعلية.
    *   إذا لم يتم تحديد IP، سيقوم البوت تلقائياً بجلب عنوان السيرفر الافتراضي المسجل في قاعدة البيانات.

3.  **دعم التوثيق (Message Content Intent):**
    *   النظام مصمم ليثبت لفريق ديسكورد حاجة البوت لقراءة الرسائل لتقديم ميزة "المراقب التلقائي" التي توفر الوقت والجهد على اللاعبين.

---

## 📝 ماذا تكتب في طلب التوثيق (Verification Description)؟

> **English Version (Recommended for Discord):**
> "ProMcBot offers a sophisticated 'Minecraft Royal Watcher' feature designed for the gaming community. This feature automatically identifies Minecraft server IP addresses shared in chat and instantly displays rich, real-time statistics (players, version, MOTD, and ping) using a premium luxury interface. To respect server rules, this feature is optional and can be toggled on/off by server administrators via the `/toggle-watcher` command, with settings stored in our MongoDB database. This functionality is crucial for our users as it provides immediate value without requiring manual commands, making the 'Message Content Intent' essential for the bot's core automated experience."

---

## 🛠️ الملفات المضافة والمحدثة في فرع `hi`:
*   `bot/Models/Server.js`: تحديث نموذج البيانات لإضافة `watcherEnabled`.
*   `bot/events/MinecraftWatcher.js`: نظام المراقبة التلقائي المربوط بقاعدة البيانات.
*   `bot/Commands/Slash/Misc/mc.js`: أمر `mc` الملكي الجديد.
*   `bot/Commands/Slash/Misc/toggle-watcher.js`: أمر التحكم في تشغيل/إيقاف المراقبة.
*   `README_DOC.md`: دليل الاستخدام والتوثيق.
