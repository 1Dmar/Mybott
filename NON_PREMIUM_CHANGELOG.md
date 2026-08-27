# ProMcBot — Non-Premium Implementation Changelog

**Author:** Manus AI  
**Repository:** [1Dmar/Mybott](https://github.com/1Dmar/Mybott)  
**Scope:** All requested work from `pasted_content(2).txt`, except Premium.

## Scope boundary

بناءً على آخر توجيه، تم استثناء Premium بالكامل من التطوير. لم يتم تعديل Premium settings، أو منطق الاشتراكات، أو الدفع، أو الصلاحيات، أو تصميم Premium Page ضمن هذه الدورة. كما تمت استعادة ملف Premium Page إلى النسخة السابقة قبل إعادة التصميم، ثم أُجريت كل التغييرات اللاحقة خارج هذا الملف. يمكن التحقق من ذلك بمقارنة `dash/dashboard/pages/premium.html` مع baseline commit `8326a282d`.

## ما تم تنفيذه

| المجال | التنفيذ | الملفات الرئيسية |
|---|---|---|
| Feature tags and locks | تم الحفاظ على البوابات الخلفية الموجودة، وتحسين حالات القفل المرئية. صفحة Moderation تعرض تحذير Pro واضحًا وتعطّل كل عناصر التحكم، بينما يظل endpoint الخلفي يعيد `402` عند محاولة تجاوز الواجهة. صفحة Intelligence تعرض حالة المزايا والخطة المطلوبة، وصفحة Modules تعرض وسوم الخطة المطلوبة. | `dash/dashboard/pages/moderation.html`, `dash/dashboard/pages/intelligence.html`, `dash/dashboard/pages/modules.html`, `dash/index.js` |
| Intelligence activation | أضيف شرح مباشر لمعاني خطوات heartbeat وtelemetry وplayer activity وcomparison window وserver intelligence، مع إصلاح عرض Model Category وملء القائمة بدل ظهور Dropdown فارغ. | `dash/dashboard/pages/intelligence.html` |
| Action Center | أُعيد بناء التصميم ليشمل Hero واضحًا، سياق السيرفر، زر Refresh، شرائح evidence، بطاقات التوصيات، حالات confidence، وقسم notifications متجاوبًا مع الهاتف. تم الحفاظ على API والإجراءات الموجودة. | `dash/dashboard/pages/actions.html` |
| Moderation Settings | أُعيد بناء التصميم البصري للصفحة، مع server context، بطاقات الفلاتر، checklist، وPro lock banner. لا يمكن تفعيل الأزرار أو الحفظ عند عدم توفر Pro لأن الخادم يرفض العملية أيضًا. | `dash/dashboard/pages/moderation.html`, `dash/index.js` |
| Modules / Audit Logging | صارت الوحدات المكوّنة تعرض زر Enable أو Disable عندما تكون قابلة للتبديل، بدل عرض Connect شكليًا. الوحدات المقفلة تعرض required-plan tag، والوحدات غير القابلة للتبديل تحتفظ برابط الإعداد الخاص بها. | `dash/dashboard/pages/modules.html`, `dash/index.js` |
| Moderation command | تم إصلاح رسائل `/moderation settings` بحيث تُنسّق emoji objects عبر formatter ثابت بدل تمرير القيم الخام التي قد تظهر كـ`undefined` أو object غير صالح داخل الرسالة. | `bot/Commands/Slash/AutoMod/settings.js` |
| Server Blacklist | أضيفت طبقة مشتركة تتحقق من permanent وexpiry، وتحذف الإدخالات المنتهية، وتطبق المنع على prefix commands وslash interactions. يوجد bypass محدود لمالكَي أمر blacklist حتى يمكن إدارة القائمة وإزالة الحظر. | `bot/utils/blacklistGuard.js`, `bot/events/messageCreate.js`, `bot/events/interactionCreate.js` |
| Public Stats Page | أُعيد بناء صفحة الإحصاءات بتصميم أزرق زجاجي فخم، server hero، connection pulse، metric cards، activity pulse، privacy panel، وcopyable share link. المسار الجديد هو `/stats/<guildId>` مع إبقاء query route للتوافق. | `dash/dashboard/pages/stats.html`, `dash/index.js` |
| Public Profile | أُعيد بناء بطاقة الحساب العامة بتصميم banner/avatar/badges/status/privacy، مع زر نسخ الرابط. أضيفت مسارات `/user/<username>` و`/profile/<id-or-username>` مع إبقاء `/u/...` alias. البحث باسم المستخدم يعتمد على المستخدمين الذين يستطيع Discord client حلّهم أو يراهم في cache؛ الرابط المعتمد دائمًا هو ID عندما لا يتوفر cache موثوق. | `dash/dashboard/pages/profile.html`, `dash/index.js`, `bot/Models/UserProfile.js` |
| Discord public embed | أمر `/stats` بخيار `Public Stats Card` يشارك الآن رابط `/stats/<guildId>` النظيف بدل query-only URL، ويحتفظ بتوضيح الخصوصية داخل الـembed. | `bot/Commands/Slash/Misc/stats.js` |
| Deployment documentation | تم تحديث runbook لشرح المسار الجديد، username profile limitation، ومتغير `PUBLIC_STATS_URL`. | `docs/PUBLIC_STATS_RUNBOOK.md` |

## المسارات العامة الجديدة

| المسار | الغرض |
|---|---|
| `/stats/<DISCORD_GUILD_ID>` | صفحة إحصاءات عامة للسيرفر تعتمد على aggregates فقط. |
| `/stats?guildId=<DISCORD_GUILD_ID>` | مسار توافق قديم لنفس صفحة الإحصاءات. |
| `/user/<USERNAME>` | بطاقة حساب عامة عندما يستطيع bot حلّ username من Discord client/cache. |
| `/profile/<DISCORD_USER_ID>` | الرابط الأكثر موثوقية للحساب العام. |
| `/u/<ID-or-USERNAME>` | alias للتوافق يعيد التوجيه إلى `/profile/...`. |
| `/api/public/stats/<DISCORD_GUILD_ID>` | API عام لمجاميع telemetry فقط. |
| `/api/public/profile/<ID-or-USERNAME>` | API عام للهوية العامة والبيانات الاختيارية الآمنة فقط. |

> لا تنشر الصفحة العامة أو رابط stats لسيرفر إلا بموافقة مالكه. الاستجابة العامة لا تعرض أسماء اللاعبين، raw telemetry، قائمة أعضاء Discord، أو بيانات guild الخاصة.

## إعداد `stats.promcbot.dev`

1. انشر commit المشروع على خدمة Node/Express نفسها التي تشغل dashboard/backend، وتأكد أن رابط Railway الافتراضي يفتح `/health`.
2. من Railway افتح **Settings → Networking → Public Networking → + Custom Domain** وأضف `stats.promcbot.dev`.
3. أضف سجلات DNS التي تعرضها Railway حرفيًا، بما في ذلك CNAME وTXT عند طلب التحقق. لا تستخدم قيمة CNAME ثابتة من هذا الملف؛ القيمة تختلف حسب الخدمة.[1]
4. بعد اكتمال التحقق، أضف متغير البيئة التالي إلى **الخدمة نفسها** ثم أعد النشر:

```env
PUBLIC_STATS_URL=https://stats.promcbot.dev
```

5. اختبر بالترتيب:

```text
https://stats.promcbot.dev/health
https://stats.promcbot.dev/stats/<guild-id>
https://stats.promcbot.dev/api/public/stats/<guild-id>
```

> إعداد DNS وRailway لا يتم من داخل Git. يجب تنفيذ خطوات custom domain في لوحة Railway ومزود DNS، ثم نشر متغير البيئة.

## التحقق والاختبارات

تم تنفيذ فحوصات JavaScript وwhitespace على الملفات المتغيرة، ثم تشغيل الاختبارات الكاملة للمشروع. النتيجة الحالية هي **67 اختبارًا ناجحًا، 0 فشل**. أضيفت اختبارات مستقلة لحالات blacklist الدائم، النشط، المنتهي، والمدخل غير الصالح.

كما تم تشغيل smoke test متجاوب بالبيانات المقروءة mock-only على الصفحات التالية عند عرض 390px وعرض 1440px: Action Center، Moderation Settings، Intelligence، Modules، Public Stats، وPublic Profile. لم يظهر horizontal overflow أو console error غير متوقع. استجابة `402` في Moderation كانت مقصودة وتم التحقق من ظهور lock banner وتعطيل عناصر التحكم.

تم حفظ صور المعاينة في الملفات التالية خارج المستودع: `actions-mobile.png`, `moderation-mobile.png`, `stats-mobile.png`, و`profile-mobile.png`.

## ملاحظات التشغيل

لا يمكن تنفيذ username lookup عالمي عبر Discord لمستخدم غير موجود في cache أو دون معرف Discord؛ لذلك لا ينبغي وعد المستخدم بأن كل username عشوائي سيُحلّ تلقائيًا. استخدم `/profile/<DISCORD_USER_ID>` للحالات المضمونة، أو تأكد من أن bot قابل المستخدم قبل مشاركة `/user/<USERNAME>`.

تم الحفاظ على حدود Premium كما طُلب: التغييرات الحالية لا تضيف أي سلوك جديد إلى Premium، ولا تُعيد تصميم Premium، ولا تغيّر إعدادات Premium أو تدفق الدفع.

## References

[1]: https://docs.railway.com/networking/domains/working-with-domains "Railway — Working with Domains"
