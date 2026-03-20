# 👑 ProMcBot | Minecraft Royal Watcher

هذا النظام الجديد تم تطويره خصيصاً لخدمة مجتمع ماين كرافت (لاعبين وأصحاب خوادم) مع التركيز على تفعيل خاصية **Message Content Intent** لضمان قبول توثيق البوت.

## ✨ الميزات الجديدة (التحديث الملكي)

1.  **Minecraft Auto-Watcher (Message Content Intent):**
    *   يقوم البوت بمراقبة المحادثات بحثاً عن عناوين IP لخوادم ماين كرافت.
    *   عند اكتشاف عنوان، يظهر البوت تلقائياً حالة الخادم (اللاعبين، الإصدار، الوصف) بتصميم ملكي فخم.
    *   **لماذا هذا مطلوب للتوثيق؟** لأنه يثبت أن البوت يحتاج لقراءة محتوى الرسائل لتقديم ميزة فورية وتلقائية للمستخدمين دون الحاجة لأوامر.

2.  **Slash Command `/mcstatus`:**
    *   أمر سلاش يتيح للمستخدمين الاستعلام عن أي خادم ماين كرافت يدوياً.
    *   يعرض تفاصيل تقنية كاملة مع صورة الـ Ping الخاصة بالخادم.

3.  **تصميم ملكي (Royal Design):**
    *   استخدام ألوان ذهبية (`#D4AF37`) ورسائل Embed منظمة جداً تعطي انطباعاً بالفخامة.
    *   أزرار تفاعلية وروابط لدعم البوت والموقع الرسمي.

---

## 📝 ماذا تكتب في طلب التوثيق (Verification Description)؟

عند التقديم لطلب التوثيق والحصول على **Message Content Intent**، انسخ واكتب ما يلي:

> **English Version (Recommended for Discord):**
> "Our bot, ProMcBot, provides a unique 'Minecraft Auto-Watcher' feature that automatically detects Minecraft server IP addresses within chat messages. When an IP is mentioned, the bot instantly fetches and displays real-time server statistics (online players, version, MOTD, and ping) using a luxury 'Royal' interface. This feature is essential for our gaming community as it allows players to quickly check server status without manually running commands, fostering a more interactive and seamless experience. To achieve this automation, the bot requires the 'Message Content Intent' to scan for IP patterns and provide immediate value to Minecraft server owners and players alike."

> **النسخة العربية (لفهمك الشخصي):**
> "بوت ProMcBot يقدم ميزة 'مراقب ماين كرافت التلقائي' التي تكتشف عناوين خوادم ماين كرافت داخل الرسائل. عند ذكر أي عنوان، يقوم البوت فوراً بجلب وعرض إحصائيات الخادم (اللاعبين، الإصدار، والوصف) بتصميم ملكي فاخر. هذه الميزة أساسية لمجتمعنا لأنها تتيح للاعبين التحقق من حالة الخوادم تلقائياً دون الحاجة لكتابة أوامر، مما يوفر تجربة سلسة وتفاعلية. ولتحقيق هذا، يحتاج البوت لخاصية 'Message Content Intent' لمسح الرسائل والتعرف على عناوين الخوادم وتقديم قيمة فورية للمستخدمين."

---

## 🛠️ الملفات المضافة في فرع `hi`:
*   `bot/events/MinecraftWatcher.js`: المسؤول عن المراقبة التلقائية (Intent).
*   `bot/Commands/Slash/Misc/mcstatus.js`: أمر السلاش الجديد.
*   `README_DOC.md`: هذا الملف الإرشادي.
