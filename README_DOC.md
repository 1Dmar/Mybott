# 👑 ProMcBot | Minecraft Royal Hub (The Ultimate Intent Solution)

هذا التحديث يحول البوت إلى **مركز تفاعلي حي** لمجتمع ماين كرافت، مما يجعله الخيار الأول لقبول **Message Content Intent** وتوثيق البوت.

## ✨ الميزات الجديدة (الثورة التنافسية الملكية)

1.  **Royal Quick Challenges (تلقائي - يحتاج للـ Intent):**
    *   البوت يراقب نشاط الشات ويطرح "تحديات ملكية سريعة" بشكل عشوائي (أسئلة عن ماين كرافت).
    *   **لماذا هذا مطلوب للتوثيق؟** لأنه يثبت أن البوت يراقب المحادثات لحظياً لتقديم تجربة "Gamification" تفاعلية، حيث يحتاج لقراءة إجابات اللاعبين في الشات لتحديد الفائز ومنحه "الوسام الملكي".

2.  **Minecraft Social Hub (LFG & Achievements):**
    *   **نظام LFG:** تحويل رسائل "البحث عن شركاء للعب" إلى دعوات انضمام ملكية بضغطة زر.
    *   **نظام Achievements:** تكريم اللاعبين عند ذكر إنجازاتهم في الشات بتصاميم Embed فخمة.

3.  **أمر `!mc` الملكي (Message Command):**
    *   أمر رسائل تقليدي بتصميم ذهبي فخم يعرض إحصائيات الخادم وصورة الـ Ping.

4.  **التحكم الكامل (MongoDB):**
    *   يمكن تشغيل أو إيقاف هذه الميزات الاجتماعية والتنافسية عبر الأمر `/toggle-watcher`.

---

## 📝 ماذا تكتب في طلب التوثيق (Verification Description)؟

> **English Version (Recommended for Discord):**
> "ProMcBot is an interactive community bot that enhances Minecraft servers through the 'Royal Hub' system. This feature relies heavily on the 'Message Content Intent' to provide real-time engagement. It automatically identifies player intent, such as 'Looking For Group' (LFG) requests or shared achievements, and converts them into high-end visual cards. Most importantly, it hosts 'Royal Quick Challenges'—automated mini-games that monitor chat for correct answers to Minecraft-related questions. This active participation requires the bot to scan user messages to reward winners instantly, fostering a competitive and lively environment. Without the 'Message Content Intent,' this seamless automation and community engagement would not be possible."

---

## 🛠️ الملفات المضافة والمحدثة في فرع `hi`:
*   `bot/events/MinecraftSocialHub.js`: محرك التحديات والأنظمة الاجتماعية (الـ Intent).
*   `bot/events/MinecraftWatcher.js`: مراقب الخوادم التلقائي.
*   `bot/Commands/Message/Misc/mc.js`: أمر `!mc` الملكي.
*   `bot/Commands/Slash/Misc/toggle-watcher.js`: أمر التحكم.
*   `README_DOC.md`: دليل الاستخدام والتوثيق.
