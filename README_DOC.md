# 👑 ProMcBot | Minecraft Social Hub (The Intent Revolution)

هذا التحديث هو الأذكى والأكثر تطوراً لخدمة مجتمع ماين كرافت، حيث يحول البوت من مجرد "أداة" إلى **مساعد اجتماعي ذكي** يعتمد كلياً على **Message Content Intent**.

## ✨ الميزات الجديدة (الثورة الاجتماعية الملكية)

1.  **Minecraft Social Hub (تلقائي - يحتاج للـ Intent):**
    *   البوت يراقب المحادثات بشكل ذكي ويتفاعل مع اللاعبين بناءً على "معنى" رسائلهم.
    *   **نظام LFG (البحث عن شركاء):** عندما يكتب لاعب أنه يبحث عن شخص للعب، يقوم البوت تلقائياً بإنشاء "دعوة انضمام ملكية" مع أزرار تفاعلية.
    *   **نظام Achievement Showcase:** البوت يكتشف الإنجازات التي يكتبها اللاعبون (مثل الفوز أو جمع الموارد) ويقوم فوراً بتصميم "شهادة تميز ملكية" لهم في القناة.
    *   **لماذا هذا مطلوب للتوثيق؟** لأنه يثبت أن البوت يقدم ميزات "اجتماعية وتفاعلية" تعتمد حصرياً على فهم محتوى الرسائل لحظياً، وهو ما لا يمكن تحقيقه بأوامر السلاش.

2.  **أمر `!mc` الملكي المطور:**
    *   أمر رسائل تقليدي (`!mc`) بتصميم ذهبي فخم يعرض إحصائيات الخادم وصورة الـ Ping.

3.  **التحكم الكامل (MongoDB):**
    *   يمكن تشغيل أو إيقاف هذه الميزات الاجتماعية عبر الأمر `/toggle-watcher`.

---

## 📝 ماذا تكتب في طلب التوثيق (Verification Description)؟

> **English Version (Recommended for Discord):**
> "ProMcBot introduces the 'Minecraft Social Hub,' a groundbreaking AI-driven automation feature that revolutionizes how players interact. By leveraging the 'Message Content Intent,' the bot intelligently scans chat messages to identify player intent in real-time. It automatically generates 'Royal Join Invitations' when players look for groups (LFG) and creates 'Achievement Showcase' certificates when players share their milestones. This seamless interaction fosters a vibrant gaming community without the friction of manual commands. This deep integration is only possible with the 'Message Content Intent,' providing essential automated value to Minecraft players and server administrators alike."

---

## 🛠️ الملفات المضافة والمحدثة في فرع `hi`:
*   `bot/events/MinecraftSocialHub.js`: المحرك الاجتماعي الذكي (الـ Intent).
*   `bot/events/MinecraftWatcher.js`: مراقب الخوادم التلقائي.
*   `bot/Commands/Message/Misc/mc.js`: أمر `!mc` الملكي.
*   `bot/Commands/Slash/Misc/toggle-watcher.js`: أمر التحكم.
*   `README_DOC.md`: دليل الاستخدام والتوثيق.
