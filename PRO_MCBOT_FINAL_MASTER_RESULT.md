# ProMcBot — التقرير النهائي لتطبيق `pasted_content(2).txt`

**التاريخ:** 27 أغسطس 2026
**المستودع:** `1Dmar/Mybott`
**الفرع المستخدم:** `copilot/update-bot-design-and-translation-system`
**Commits هذه الدورة:** `d376123e9` (implementation)، `b78283a02` (report)، `ae1968337` (PayPal checkout diagnostics) + `bac57a840` (Pro-only plan fix) + `b55714846` (Premium array contract fix) + `b43768739` (PayPal diagnostics) + `e06d87db6` (verified-payment entitlement gate) + `da810fd1f` (Premium visual redesign) + `80aa1c95a` (non-force merge) + `578d64132` (checkout hardening) + `76316a234` (remote merge) + `e264de336` (checkout diagnostics) + `813b31c78` (latest Premium merge)

## الملخص التنفيذي

تم تطبيق دورة المواصفة الجديدة على Discord bot وDashboard وbackend وMinecraft plugin، مع الالتزام بالعمل على الفرع الافتراضي فقط. شملت التغييرات server scoping فعليًا، حراسة وجود bot في Discord، Premium gating من الخادم والواجهة وأوامر AutoMod، تحسين Premium وAction Center وModeration، إصلاح outputs الخاصة بـAutoMod وblacklist، وإضافة تجربة عامة لـStats/Profile مع Discord embed وrunbook للدومين `stats.promcbot.dev`.

النتيجة لا تدعي أن الخدمات الخارجية أصبحت مهيأة تلقائيًا. الدفع الحقيقي، OAuth وMongoDB وDiscord الحي، DNS/Railway، وruntime acceptance على خوادم Minecraft خارجية تحتاج إعدادًا واختبارًا خارج Git. عند غياب الدليل تعرض الواجهة `not configured` أو `not enough data` بدل metric أو payment وهمي.

> **المبدأ التشغيلي:** لا يتحول heartbeat إلى player analytics كاملة إلا بعد استقبال telemetry حقيقية، ولا يتحول checkout إلى اشتراك إلا بعد provider webhook موثق.

## هوية الإصدار والقيود المحترمة

| البند | النتيجة |
|---|---|
| Repository | `1Dmar/Mybott` |
| الفرع | `copilot/update-bot-design-and-translation-system` |
| `main` | لم يُعدّل |
| فرع جديد | لم يُنشأ |
| Commits | `d376123e9` (implementation) + `b78283a02` (report) + `ae1968337` (PayPal diagnostics) + `bac57a840` (Pro-only plan fix) + `b55714846` (Premium array contract fix) + `b43768739` (PayPal diagnostics) + `e06d87db6` (verified-payment entitlement gate) + `da810fd1f` (Premium visual redesign) + `80aa1c95a` (non-force merge) + `578d64132` (checkout hardening) + `76316a234` (remote merge) + `e264de336` (checkout diagnostics) + `813b31c78` (latest Premium merge) |
| Logs page | لم تُعدّل `dash/dashboard/pages/logs.html` |
| Models | لم تُعدّل أي ملفات تحت `bot/Models/**` |
| الأسرار | لم تُضف tokens أو secrets إلى Git أو التقرير |
| health المنشور | `https://promcbot.dev/health` = HTTP 200؛ `https://stats.promcbot.dev/health` = HTTP 525 Cloudflare |

## ما تم تغييره

| المجال | التنفيذ الفعلي | التحقق |
|---|---|---|
| My Servers وworkspace | حصر القائمة في Discord Owner أو Administrator فقط، واستبعاد العضو العادي وManage Server وحدها، مع فصل platform override عن تسمية Discord Owner | اختبارات guild access ناجحة |
| Bot membership | فحص cache ثم `guilds.fetch()` عند غياب cache، وتمييز installed/absent/unknown، مع invite URL عند الغياب | اختبارات cache/fetch/invite ناجحة |
| Server context | صفحات Intelligence وAction Center وPremium أصبحت server-scoped تحت `/myservers/:guildId/...` ولا تعرض dropdown شاملًا عند اختيار server | فحص routes والواجهة ناجح |
| Discord banners | endpoint visual يجلب banner من Discord ثم يستخدم icon وdominant-color fallback دون كشف secrets | اختبارات server visuals ناجحة؛ يلزم Discord حي للـacceptance |
| Settings | حفظ Minecraft IP وJava port مع validation وبدون اختراع اتصال عند غياب العنوان | اختبارات settings ناجحة |
| Activation وIntelligence | حالات degraded واضحة، خطوات setup مبنية على evidence، وcatalog لا يختفي عند فشل entitlement | اختبارات intelligence وtelemetry ناجحة |
| Modules وModeration | إضافة `moderation.advanced: pro`، lock metadata، HTTP 402 من الخادم، disabled controls في الواجهة، وruntime gate لأوامر AutoMod الستة | اختبارات gate وconfiguration ناجحة |
| AutoMod outputs | defaults آمنة لـenabled/filters/limits/action/logChannel، وإضافة emoji aliases `USER` و`WRENCH`، وعدم ظهور `undefined` في النصوص | syntax وgrep وtests ناجحة |
| Blacklist | parser صريح لـ`ms,s,m,h,d,w,mo,inf`، دعم `5mo`، رفض القيم غير الصحيحة، ورسالة permission واضحة | اختبارات parser ناجحة |
| Action Center | عرض confidence وsample evidence وcomparison window، أفعال read/resolve الفعلية للتنبيهات، ورابط navigation حقيقي إلى Setup & Intelligence، بلا remote action وهمي | backend contract وQA محلي |
| Premium | صفحة server-scoped بهوية server محدد، tags `FREE/PRO/ULTIMATE`، hierarchy أوضح، methods صادقة، وcheckout/cancel dynamic return URLs | اختبارات billing وfull QA؛ provider حي غير مهيأ |
| Stats العامة | `/stats?guildId=<id>` و`/api/public/stats/:guildId` تعرض aggregates خلال 24 ساعة: joins/leaves/count/telemetry وحالة plugin | اختبارات public stats وvisual QA محلي |
| Profile العامة | `/profile/<DiscordUserId>` وalias `/u/<id>` يعرضان Discord public identity فقط؛ لا claims عن XP/ranking غير المخزن | فحص بصري محلي؛ Discord حي يلزم للجلب |
| Discord announcement embed | خيار `Public Stats Card` داخل أمر `/stats` ينشئ embed ورابطًا عامًا ويشرح privacy | command catalog وsyntax ناجحان |
| Minecraft plugin | Maven artifact في `plugin/target`، وdeliverable محدث في `deliverables/ProMcBot-0.1.0-Universal-Bukkit.jar`، Java major version 52 | Maven test/package وفحص JAR ناجحان |

## My Servers والصلاحيات

المسار `/myservers` يعتمد على guilds التي يعيدها Discord OAuth بعد تطبيق workspace filter. لا يظهر server لمجرد أن المستخدم عضو فيه، ولا تكفي Manage Server وحدها في هذا النظام. routes وAPIs server-scoped محمية كذلك بـ`resolveWorkspaceGuildReference` و`requireGuildManager`، لذلك لا يكفي تغيير `guildId` يدويًا للوصول إلى server غير مُدار.

تم فصل **Platform access** عن دور Discord الحقيقي. إذا كان المستخدم platform owner فقد يملك صلاحية إدارية على مستوى المنصة، لكن ذلك لا يجعل كل guild يظهر كأنه Owner في Discord. الـbadge يعرض الدور المثبت من Discord، بينما override يظهر كتسمية منفصلة.

## Bot membership وbanners

عند غياب guild من cache، يحاول backend استخدام Discord `guilds.fetch()` قبل تقرير أن bot غير موجود. أخطاء Discord التي تثبت الغياب فقط مثل 10004/404 تتحول إلى `absent`، بينما أخطاء rate limit أو الشبكة غير الحاسمة تبقى `unknown` ولا تُعرض للمستخدم كغياب مؤكد. إذا كان bot غائبًا فعلًا، يعيد server-scoped flow إلى My Servers أو يعرض invite URL بحسب المسار.

endpoint visual يحاول جلب banner الحقيقي، ثم icon الحقيقي، ثم يحسب dominant color عند عدم وجود banner، ثم يستخدم fallback ثابتًا عند فشل الصور. الاختبارات تثبت بناء CDN/fallback وحساب اللون، لكن ظهور banner الحقيقي يحتاج جلسة Discord وguild فعلية في deployment.

## Settings وSetup & Intelligence

عند حفظ Minecraft settings، تتم validation للـIP والـport، وتُكتب `mcIp` إلى `GuildSettings`، بينما تُحفظ `javaIP` و`javaPort` في `ServerInfo` للمستهلكين الأساسيين. ترك العنوان فارغًا لا ينشئ اتصالًا وهميًا. حفظ IP وport لا يكفي لإظهار players أو intelligence؛ هذه البيانات تأتي من plugin telemetry.

المسار التشغيلي المقصود هو:

```text
/myservers
→ /myservers/:guildId/overview
→ /myservers/:guildId/intelligence
```

صفحة Setup تعرض server المحدد من route فقط، ولا تعرض dropdown بجميع السيرفرات. بطاقة Activation تعرض مهامًا حقيقية مثل حالة bot، provisioning، وضع JAR، تشغيل Paper، heartbeat، وصول telemetry، ثم كفاية البيانات. عند غياب Mongo أو plugin تعرض حالة degraded/waiting صريحة بدل `Loading` دائم أو checkmark مصطنع.

إذا ظهر `plugin_provisioning_not_configured`، فالحل هو إضافة `PLUGIN_ENCRYPTION_KEY` إلى deployment environment ثم redeploy وإعادة Generate. لا توجد قيمة افتراضية آمنة يمكن للكود اختراعها لهذا السر، ولا ينبغي وضعه في chat أو Git.

## Premium وPayPal

الـbilling authority بقيت PayPal فقط. الواجهة لا تمكن checkout إذا كان provider أو method المطلوب غير مهيأ، ولا تعطي paid entitlement من زر أو browser redirect. Card وGoogle Pay لا يظهران كجاهزين إلا عندما تسمح إعدادات PayPal الحالية بهما؛ لم تُضف Stripe ولم تُخزّن بيانات card خام. بعد ظهور `billing_checkout_failed` في الاختبار، أضيفت معالجة آمنة تعرض سبب PayPal القابل للتنفيذ وPayPal debug ID الاختياري بدل الرسالة العامة وحدها، مع بقاء entitlement على Free حتى يصل webhook موثق. كما تم إصلاح شرط سابق كان يحجب PayPal إذا كان Ultimate Plan ID غير موجود؛ أصبح Pro قابلًا للشراء عند إعداد Pro فقط، بينما يبقى Ultimate معطلًا حتى إنشاء خطته. وكُشف وأُصلح mismatch إضافي: endpoint يعيد `plans` كمصفوفة، بينما كانت الواجهة تقرأها ككائن؛ أصبحت الواجهة تتعامل مع الشكلين وتتحقق من Plan ID الخاص بالخطة المختارة. أضيف أيضًا زر `Verify PayPal setup` وendpoint authenticated يفحص OAuth وPlan IDs داخل Sandbox/Live دون إعادة credentials. وأُغلقت ثغرة refresh: `APPROVAL_PENDING` و`APPROVED` و`active`/`trialing` بلا `metadata.paymentVerified === true` تعود إلى Free، ولا تُثبت علامة الدفع إلا من أحداث payment completed الموثقة؛ كما أُصلحت رسائل cancel لتُظهر سبب provider الآمن بدل `billing_cancel_failed` العامة. أضيفت أيضًا headers PayPal الموصى بها (`Prefer` و`PayPal-Request-Id`) وتحديد مرحلة `create_subscription` عند فشل provider، مع حماية نجاح checkout من فشل Audit غير الجوهري. دُمجت إعادة تصميم Premium البصرية وتغييرات remote دون فقد gating الأمني.

لتشغيل Sandbox، اضبط في خدمة backend المتغيرات المطلوبة في البيئة نفسها كما هو موثق في `docs/PAYMENTS.md` و`docs/PREMIUM.md`، ومنها `PAYPAL_ENV=sandbox` وبيانات PayPal sandbox وplan IDs وwebhook ID. استخدم حسابات PayPal sandbox، ثم أنشئ checkout من صفحة server-scoped Premium، واترك provider يعيد المستخدم إلى مسار server المحدد. منح الوصول لا يثبت إلا عند وصول webhook صحيح والتحقق منه.

في Production يجب استبدال بيانات sandbox ببيانات live، وضبط webhook endpoint على `/api/billing/webhook/paypal`، والتأكد من `PUBLIC_BASE_URL` وOAuth callback وTLS. لم يتم تنفيذ تحويل مال أو claim بأن الحساب التجاري أو webhook live مهيأ، لأن ذلك يحتاج حساب المستخدم واعتماداته خارج Git.

## Action Center وModeration

Action Center يعرض فقط observations مبنية على telemetry، مع confidence وrecent/comparison sample. إذا لم توجد بيانات كافية، يشرح أن المطلوب هو إبقاء plugin متصلًا وجمع events، ولا ينشئ trend أو action وهميًا. `Mark read` و`Resolve` مرتبطان بعمليات backend فعلية. أما recommendation فتعرض كـ`Recommendation only`، والرابط المتاح هو navigation آمن إلى Setup & Intelligence وليس remote Minecraft command غير مثبت.

Moderation gated من ثلاث طبقات: metadata وlock tag في Modules، HTTP 402 من moderation API حتى مع تعديل الواجهة عبر F12، و`moderationGate` داخل أوامر AutoMod runtime. هذا gate يغطي action/filter/log/settings/toggle/whitelist. عند فشل التحقق من entitlement لا تُنفذ قراءة أو كتابة إعدادات moderation.

## Stats/Profile العامة و`stats.promcbot.dev`

صفحة Stats العامة صممت كبطاقة compact/luxury بدل dashboard مزدحم. endpoint العام يعرض aggregates فقط: عدد joins/leaves خلال 24 ساعة، أحدث player count المقاس، عدد telemetry events، وحالة آخر heartbeat. لا يعرض أسماء اللاعبين أو قائمة Discord members أو raw events. عند عدم وجود evidence حديث يظهر dash ورسالة واضحة؛ لا يتم تحويل heartbeat وحده إلى retention أو trend.

صفحة Profile العامة canonical هي ID-based لأن username ليس registry فريدًا في هذه الدورة. endpoint يجلب Discord public identity فقط عندما يستطيع bot client الوصول إليه، ولا يخترع XP أو levels أو rankings. `/u/:id` alias إلى `/profile/:id`.

خطوات ربط `stats.promcbot.dev` موثقة في [`docs/PUBLIC_STATS_RUNBOOK.md`](docs/PUBLIC_STATS_RUNBOOK.md). الخلاصة هي إضافة domain إلى Railway، وضع **CNAME وTXT معًا** كما تعرضهما Railway، ثم ضبط:

```env
PUBLIC_STATS_URL=https://stats.promcbot.dev
```

بعدها تُختبر `/health` و`/stats?guildId=<guild-id>` و`/api/public/stats/<guild-id>`. تم فحص النطاق بعد push: DNS لـ`stats.promcbot.dev` يحل عبر Cloudflare، لكن HTTPS يعيد **525 Origin SSL Handshake Failed**؛ لذلك الصفحة والكود جاهزان، أما origin SSL/Cloudflare mode فيحتاج إصلاحًا خارجيًا في Railway/Cloudflare. `https://promcbot.dev/health` أعاد HTTP 200. لا يدعي المستودع أن هذا الإصلاح الخارجي تم تلقائيًا.[1] [2]

## Minecraft plugin

الـJAR مبني على Bukkit/Spigot API compatibility وبـJava 8 bytecode، ويستهدف عائلة Spigot/Paper/Bukkit في الإصدارات المطلوبة 1.8.x و1.12.x و1.16.x و1.20.x و1.21.x. لا يشمل ذلك PocketMine-MP/Bedrock، ولا يعني أن كل إصدار تم تشغيله في server خارجي.

Maven أثبت compile/package والاختبارات الموجودة فقط. لا ينبغي إعلان runtime certification لكل إصدار أو منصة قبل تشغيل خوادم Spigot/Paper حقيقية. الـdeliverable الحالي:

| العنصر | القيمة |
|---|---|
| الملف | `deliverables/ProMcBot-0.1.0-Universal-Bukkit.jar` |
| Maven output | `plugin/target/promcbot-plugin-0.1.0.jar` |
| plugin descriptor | `plugin.yml` |
| main class | `dev/promcbot/plugin/ProMcBotPlugin.class` |
| Java major version | `52` |
| SHA-256 | `baa37d35c04669475148562401d4ed13abf2f2c0bbb9c4861c727914f6faff65` |

## الاختبارات المنفذة

تم تشغيل المجموعة الكاملة بعد إصلاح PayPal الأخير، وكانت النتيجة **72/72 ناجحة**. شملت guild access وentitlements/billing وcommand catalog وintelligence وtelemetry وmoderation defaults/gate وblacklist parser وpublic stats وserver visuals وsettings وplugin security وYAML generation.

كما نجح `npm run check`، وsyntax checks لكل JavaScript متغير، و`git diff --check`. نجح `npm run build:plugin` عبر `mvn -q -f plugin/pom.xml clean test package`. تم فحص `plugin.yml` وmain class وJava major version 52. أُجري فحص بصري محلي لصفحات Stats/Profile في Chromium؛ هذا لا يثبت DNS أو OAuth أو Discord REST أو MongoDB أو Paper runtime.

## مصفوفة المطابقة النهائية

| البند | الحالة | الملاحظة الدقيقة |
|---|---|---|
| العمل على الفرع الافتراضي فقط | **DONE** | لا `main` ولا feature branch جديد |
| Owner/Administrator فقط في My Servers | **DONE** | العضوية العادية وManage Server وحدها خارج workspace |
| منع server غير المسموح | **DONE** | server middleware وbot membership guard |
| منع false-negative عند cache miss | **DONE** | fallback إلى `guilds.fetch()` مع `unknown` للأخطاء غير الحاسمة |
| Minecraft IP والport | **DONE** | validation وحفظ فعلي في settings/server info |
| Plugin config YAML | **DONE** | line breaks فعلية لا `\\n` حرفية |
| Activation/heartbeat | **PARTIAL** | الكود يعرض evidence صادقًا؛ telemetry حي يحتاج plugin وdeployment وplayers |
| Premium server-scoped | **DONE** | لا dropdown في server Premium وreturn URLs dynamic |
| Premium provider live | **BLOCKED EXTERNAL** | يحتاج PayPal credentials وplan IDs وwebhook وdeployment |
| Moderation Pro UI/server/runtime | **DONE** | lock و402 وruntime gate لأوامر AutoMod |
| Audit Enable/Disable | **DONE** | module API/UI toggleable؛ Logs page لم تُمس |
| Action Center مفيد وآمن | **DONE** | evidence وread/resolve وsetup navigation؛ بلا remote action وهمي |
| Intelligence models nonempty | **DONE** | catalog/verification state لا يختفي عند failure |
| Blacklist وAutoMod undefined | **DONE** | parser/defaults/emoji aliases واختبارات مباشرة |
| banners وfallback colors | **DONE WITH LIVE LIMIT** | code واختبارات جاهزة؛ banner حي يحتاج Discord guild |
| Stats/Profile public experience | **DONE** | public aggregates، profile ID-based، embed ورابط عام |
| `stats.promcbot.dev` | **PARTIAL EXTERNAL** | DNS يحل، لكن HTTPS حاليًا 525؛ يلزم إصلاح origin SSL/Cloudflare خارج Git |
| runtime acceptance لكل Minecraft versions | **BLOCKED EXTERNAL** | compile/package فقط؛ لا توجد خوادم Spigot/Paper خارجية |
| Logs وModels untouched | **DONE** | لا تغييرات في المسارين المحميين |

## المطلوب خارجيًا قبل الإنتاج

يحتاج acceptance النهائي إلى deploy حديث بالـcommit `813b31c78`، والتأكد من `MONGODB_URI` وDiscord OAuth/bot credentials و`PLUGIN_ENCRYPTION_KEY` وPayPal variables في Railway، ثم توليد config جديد ووضعه مع JAR الحالي في server Bukkit/Spigot/Paper. بعد تشغيل لاعب فعليًا، يجب مراجعة activation evidence بدل اعتبار heartbeat وحده comparison window.

كما يحتاج `stats.promcbot.dev` إلى domain وDNS records يدويًا، وتحتاج payment flow إلى PayPal sandbox/live setup. يجب تدوير أي credential تم مشاركته سابقًا خارج secret manager، وعدم وضعه في Git أو chat.

## الملفات الأهم

| الملف | الغرض |
|---|---|
| `dash/index.js` | routes وauthorization وsettings وactivation وbilling وpublic stats APIs |
| `dash/botAccess.js` | bot membership decision وinvite fallback |
| `dash/moderationConfig.js` | defaults وتطبيع AutoMod |
| `bot/utils/moderationGate.js` | Pro gate لأوامر AutoMod runtime |
| `dash/publicStats.js` | aggregate-only public stats helper |
| `dash/dashboard/pages/stats.html` | public Stats card |
| `dash/dashboard/pages/profile.html` | public Discord profile card |
| `docs/PUBLIC_STATS_RUNBOOK.md` | DNS/Railway runbook لـ`stats.promcbot.dev` |
| `deliverables/ProMcBot-0.1.0-Universal-Bukkit.jar` | JAR قابل للتنزيل |

## Readiness

**Readiness: READY FOR REVIEW** — الكود والاختبارات وartifact وإغلاق ثغرة paid entitlement وإصلاح رسائل PayPal جاهزة للمراجعة على الفرع الافتراضي، مع بقاء PayPal/DNS وDiscord/Mongo وMinecraft runtime acceptance كمتطلبات تشغيل خارجية صريحة.

## References

[1]: docs/PUBLIC_STATS_RUNBOOK.md "ProMcBot Public Stats Runbook"
[2]: https://docs.railway.com/networking/domains/working-with-domains "Railway — Working with Domains"
[3]: https://docs.railway.com/variables "Railway — Using Variables"
[4]: docs/PAYMENTS.md "ProMcBot Payment Configuration"
[5]: docs/PREMIUM.md "ProMcBot Premium"
