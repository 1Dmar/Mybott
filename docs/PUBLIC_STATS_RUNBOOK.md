# ProMcBot Public Stats Runbook

## النتيجة التي يقدّمها الكود

يقدّم ProMcBot صفحة عامة في `/stats?guildId=<DISCORD_GUILD_ID>` وملف profile عام في `/profile/<DISCORD_USER_ID>`. صفحة الإحصاءات تعرض **مجاميع telemetry فقط**: آخر عدد لاعبين مقاس، عدد أحداث الدخول والخروج خلال 24 ساعة، عدد أحداث telemetry، وحالة آخر heartbeat. لا تعرض أسماء اللاعبين، قائمة أعضاء Discord، raw events، أو بيانات guild الخاصة.

يستخدم أمر Discord `/stats` الخيار `Public Stats Card` لإنشاء embed يحتوي على الرابط العام وشرح الخصوصية. الرابط يعتمد على `PUBLIC_STATS_URL`، ثم يعود إلى `PUBLIC_BASE_URL`، ثم إلى `https://promcbot.dev` إذا لم يضبط أي منهما. لذلك لا يدّعي الأمر أن `stats.promcbot.dev` جاهز قبل ربطه فعليًا بالخدمة.

## ربط `stats.promcbot.dev` بخدمة Railway

1. انشر commit المشروع على خدمة Node/Express التي تشغّل dashboard/backend، وتأكد أولًا أن رابط Railway الافتراضي يعمل مثل `https://<service>.up.railway.app/health`.
2. من إعدادات **الخدمة نفسها** في Railway افتح **Settings → Networking → Public Networking → + Custom Domain**، وأدخل `stats.promcbot.dev`. ستعرض Railway قيمة `CNAME` وقيمة `TXT` للتحقق.
3. في مزود DNS أضف السجلين اللذين تعرضهما Railway **حرفيًا**. عادةً يكون اسم السجل `stats`، وتكون قيمة CNAME هي قيمة Railway التي ظهرت لحسابك؛ لا تستخدم قيمة ثابتة من هذا الملف. أضف TXT أيضًا، لأن CNAME وحده لا يكفي للتحقق من الملكية.[1]
4. إذا كان مزود DNS هو Cloudflare، ابدأ بـ **DNS Only** للسجل أثناء التحقق إذا طلبت Railway ذلك، ثم اتبع حالة التحقق في Railway. عند استخدام proxy في Cloudflare يجب ضبط SSL/TLS على **Full** وفق إرشادات Railway؛ تجنب Full (Strict) في هذا السيناريو.[1]
5. انتظر التحقق وانتشار DNS. Railway تصدر شهادة SSL تلقائيًا بعد اكتمال إعداد الدومين، لكن DNS قد يحتاج وقتًا للانتشار.[1]
6. في Railway أضف متغير الخدمة التالي، ثم راجع staged changes وانشرها:

```env
PUBLIC_STATS_URL=https://stats.promcbot.dev
```

يمكن ترك `PUBLIC_BASE_URL` لروابط dashboard الأساسية، بينما يختص `PUBLIC_STATS_URL` بالـembed العام. لا تضع tokens أو secrets في هذا المتغير.

7. اختبر بالترتيب:

```text
https://stats.promcbot.dev/health
https://stats.promcbot.dev/stats?guildId=<guild-id>
https://stats.promcbot.dev/api/public/stats/<guild-id>
```

إذا لم تصل telemetry حقيقية بعد، يجب أن تعرض الصفحة شرطات ورسالة `no recent telemetry`؛ هذا سلوك مقصود وليس فشلًا أو metric وهميًا.

## الخصوصية والتشغيل

الـpublic stats endpoint لا يتطلب OAuth. لذلك يجب مشاركة `guildId` فقط للسيرفر الذي يريد صاحبه نشر بطاقته، وعدم وضع raw telemetry أو player identifiers في response. endpoint profile العام يقبل Discord user ID فقط ويجلب identity العامة من Discord client؛ لا يوجد في هذه الدورة username registry ولا uniqueness claim باسم المستخدم، ولذلك الرابط canonical هو ID-based `/profile/<id>`، بينما `/u/<id>` مجرد alias.

إيقاف النشر العام على مستوى server يحتاج إعداد privacy صريحًا في دورة لاحقة؛ لا ينبغي إخفاء حقيقة أن المسار الحالي public بمجرد إخفاء الرابط. حتى يتم اعتماد ذلك الإعداد، لا تُعلن روابط stats إلا للسيرفرات التي وافق مالكوها على مشاركتها.

## حدود الإثبات

هذا runbook لا يثبت أن DNS أو Railway أو PayPal تم إعدادها بالفعل؛ هذه خطوات تشغيل خارج Git. كما أن صفحة stats لا تحول heartbeat إلى player activity كاملة: join/leave وcomparison windows تحتاج أحداثًا فعلية من plugin وفترة جمع كافية.

## References

[1]: https://docs.railway.com/networking/domains/working-with-domains "Railway — Working with Domains"
[2]: https://docs.railway.com/variables "Railway — Using Variables"
