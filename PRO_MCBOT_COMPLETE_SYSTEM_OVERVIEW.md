# ProMcBot — شرح النظام الكامل

## مقدمة

هذا الملف يشرح مشروع **ProMcBot** من منظور صاحب سيرفر Discord/Minecraft: ماذا يفعل الـDiscord Bot، ماذا يقدم الـDashboard والـbackend، كيف يعمل Minecraft Plugin، ما التعديلات التي أُجريت، وما الفائدة العملية للسيرفرات. كما يتضمن تجربة تخيلية واقعية لصاحب سيرفر كبير، مع فصل واضح بين الوظائف الجاهزة في الكود وبين الأجزاء التي تحتاج إعدادًا خارجيًا أو اختبارًا حيًا.

> **الخلاصة:** ProMcBot هو نظام ربط بين Discord وMinecraft Dashboard وMinecraft Plugin. الـBot يتعامل مع Discord والأوامر والصلاحيات، والـDashboard يدير السيرفر ويعرض حالته وتحليلاته، والـPlugin يرسل telemetry حقيقية من خادم Minecraft إلى الـbackend.

المشروع لا يختلق بيانات أو مدفوعات. إذا لم تصل بيانات حقيقية من الـPlugin، يعرض النظام `not enough data` أو حالة انتظار. وإذا لم يصل PayPal webhook موثق، لا يمنح Premium حتى لو عاد المستخدم من صفحة الدفع أو عمل refresh.

## 1. الصورة الكبيرة: كيف تتصل الأجزاء معًا؟

```text
Discord Server
     │
     │ Discord OAuth + Bot membership + permissions
     ▼
ProMcBot Discord Bot ───────────────┐
     │                               │
     │ commands, moderation,          │ dashboard API
     │ premium links, announcements   │ authorization, billing
     ▼                               ▼
Minecraft Dashboard / Express Backend
     │                               │
     │ signed telemetry               │ verified PayPal webhook
     ▼                               ▼
Minecraft Plugin                    Subscription authority
     │
     │ heartbeat, player_count,
     │ player_join, player_leave
     ▼
Activation / Intelligence / Stats / Action Center
```

### المكونات الأساسية

| المكوّن | وظيفته الأساسية | من يستفيد منه؟ |
|---|---|---|
| **Discord Bot** | تنفيذ أوامر Discord، الحماية، AutoMod، blacklist، روابط Premium وStats، والتحقق من صلاحيات المستخدم | مديرو السيرفر وأعضاء الإدارة داخل Discord |
| **Dashboard + Backend** | إدارة السيرفرات، الإعدادات، التفعيل، Intelligence، Moderation، Action Center، Premium، Stats/Profile | صاحب السيرفر أو Administrator |
| **Minecraft Plugin** | الاتصال الآمن بالـbackend وإرسال heartbeat وtelemetry من خادم Minecraft | خادم Minecraft نفسه وأصحابه |
| **PayPal Billing** | إنشاء checkout والتحقق من الاشتراك عبر webhook، دون تخزين بيانات البطاقة | صاحب المنتج والعملاء المشتركون |
| **Public Stats/Profile** | عرض aggregates عامة وبطاقة Discord عامة دون كشف raw telemetry أو بيانات خاصة | أصحاب السيرفرات والزوار |

## 2. Discord Bot: ماذا يفعل؟

الـDiscord Bot هو نقطة التفاعل داخل Discord. يستطيع صاحب السيرفر استعمال الأوامر بدل فتح الـDashboard لكل عملية صغيرة، بينما تبقى العمليات الحساسة مرتبطة بصلاحيات Discord وentitlements الخاصة بالخطة.

### الوظائف الرئيسية

#### إدارة الوصول والسيرفرات

يتحقق النظام من أن المستخدم هو **Owner أو Administrator فعليًا في Discord**. لا يكفي أن يكون المستخدم عضوًا عاديًا، ولا تكفي صلاحية Manage Server وحدها لظهور السيرفر في مساحة العمل الحالية. كما يتحقق النظام من وجود الـBot داخل السيرفر قبل السماح بإدارة server-scoped resources.

إذا لم يكن الـBot موجودًا، يمكن للنظام عرض Invite URL أو إعادة المستخدم إلى My Servers بدل السماح له بتعديل سيرفر لا يستطيع الـBot خدمته.

#### الأوامر والروابط

يوفر الـBot أوامر للتنقل إلى Premium وStats، ويستخدم روابط server-scoped مثل:

```text
/myservers/<guildId>/premium
```

بدل صفحة عامة تجعل المستخدم يختار من قائمة طويلة من السيرفرات.

أمر `/stats` يحتفظ بوظيفة إحصاءات السيرفر، ويمكنه كذلك إنشاء **Public Stats Card** على شكل Discord embed يتضمن رابطًا عامًا إلى صفحة Stats، مع عدم نشر أسماء اللاعبين أو raw telemetry.

#### AutoMod وModeration

أوامر AutoMod تغطي إعدادات مثل action وfilter وlog وsettings وtoggle وwhitelist. تم إضافة Pro gate داخل runtime نفسه، وليس في الواجهة فقط. لذلك لا يستطيع المستخدم تجاوز القفل بتعديل JavaScript من خلال F12.

التحقق يتم على ثلاث طبقات:

1. metadata وlock information في Modules.
2. رفض API من الخادم بـHTTP 402 عند عدم امتلاك Pro.
3. `moderationGate` داخل أوامر Discord قبل قراءة أو كتابة إعدادات AutoMod.

إذا كان الحساب Free، لا يتم تنفيذ عملية Moderation المدفوعة.

#### Blacklist

تم إصلاح أمر blacklist ليقرأ المدد بصيغة واضحة، ومنها:

```text
ms, s, m, h, d, w, mo, inf
```

مثل:

```text
5m   = خمس دقائق
2h   = ساعتان
5mo  = خمسة أشهر
inf  = مدة غير منتهية
```

كما أصبح يعرض رسالة permission واضحة بدل أن يتوقف بصمت، ويمنع القيم غير المعلنة أو الملتبسة.

#### إصلاح رسائل Discord

تمت معالجة قيم `undefined` في AutoMod embeds من خلال defaults آمنة وemoji aliases مثل `USER` و`WRENCH`. الهدف هو ألا يرى مدير السيرفر رسالة ناقصة أو embed مكسورًا بسبب field غير موجود.

## 3. Dashboard والـBackend: ماذا يقدمان؟

الـDashboard هو واجهة الإدارة المرئية، أما الـbackend فهو السلطة التي تتحقق من الصلاحيات وتقرأ وتكتب البيانات وتطبق Premium gating. الواجهة وحدها ليست مصدر الثقة.

### My Servers

صفحة My Servers تعرض فقط السيرفرات التي يملك المستخدم فيها صلاحية مناسبة ضمن Discord workspace، وليس كل السيرفرات التي دخلها في حياته.

تم فصل الدور الحقيقي عن أي platform override. فإذا كان المستخدم Administrator في Discord، يظهر ذلك بوضوح. وإذا كان لديه وصول داخلي على مستوى المنصة، لا يتم تزوير ذلك على أنه Discord Owner.

### Server-scoped navigation

بعد اختيار سيرفر، أصبحت الصفحات مرتبطة بالسيرفر المحدد:

```text
/myservers
/myservers/:guildId/overview
/myservers/:guildId/intelligence
/myservers/:guildId/actions
/myservers/:guildId/modules
/myservers/:guildId/moderation
/myservers/:guildId/premium
```

هذا يمنع التشتت ويجعل صاحب السيرفر يعرف دائمًا أي سيرفر يقوم بتعديله. كما توجد حراسة backend تمنع تغيير `guildId` يدويًا للوصول إلى سيرفر غير مسموح.

### Server banners والهوية المرئية

يحاول النظام استخدام banner الحقيقي من Discord، ثم icon الحقيقي، ثم dominant color من صورة الـicon، ثم fallback ثابت إذا تعذر جلب الصور. هذا يعطي كل سيرفر بطاقة مرئية مميزة بدل خلفية عامة واحدة.

ظهور banner الحقيقي يحتاج أن يكون الـBot قادرًا على الوصول إلى guild وأن يعمل deployment مع Discord REST فعلي. الاختبارات المحلية تثبت منطق CDN وfallback وحساب اللون، لكنها لا تعني أن كل guild حي تم اختباره داخل Discord الحقيقي.

### Settings

يمكن لصاحب السيرفر حفظ:

```text
Minecraft address / IP
Java port
Bot prefix
Dashboard language
```

يتم التحقق من صحة العنوان والمنفذ. ترك عنوان Minecraft فارغًا لا ينشئ اتصالًا وهميًا. حفظ IP وport وحده لا يخلق بيانات players؛ هذه البيانات تحتاج Plugin متصلًا ويرسل telemetry حقيقية.

### Setup & Intelligence

صفحة Setup & Intelligence تعرض السيرفر الذي اختاره المستخدم فقط. لا يوجد dropdown شامل بجميع السيرفرات بعد الدخول إلى server context.

بطاقة Activation لا تعرض checkmarks وهمية. بل تتابع مراحل مثل:

```text
Discord bot available
Plugin provisioning configured
Config generated
JAR installed
Minecraft server running
Heartbeat received
Telemetry received
Enough data for intelligence
```

إذا كانت MongoDB أو plugin غير جاهزة، تظهر حالة degraded أو waiting بدل Loading دائم بلا تفسير.

### Intelligence

Intelligence يحلل البيانات التي وصلت فعلًا من Plugin. ومن أمثلته:

| المجال | ماذا يعرض؟ | شرط الصدق |
|---|---|---|
| Server intelligence | مؤشرات نشاط السيرفر | وجود telemetry حديثة |
| Player journey | joins وleaves ومدة قابلة للقياس | أحداث player_join وplayer_leave حقيقية |
| Retention | مؤشرات رجوع اللاعبين | نافذة زمنية كافية، وليست heartbeat واحدًا |
| Network intelligence | مقارنة instances | وجود أكثر من instance وبيانات قابلة للمقارنة |
| Recommendations | اقتراحات إدارية | تُعرض كاقتراح فقط، لا كأمر Minecraft وهمي |

إذا لم توجد بيانات كافية، يعرض النظام ذلك صراحة ولا يخترع trend أو retention.

### Action Center

Action Center هو لوحة evidence-first. يعرض:

- الملاحظة أو recommendation.
- confidence.
- sample evidence.
- comparison window.
- هل البيانات كافية أم لا.

الأفعال الفعلية المتاحة هي عمليات مثل Mark read وResolve والتنقل إلى Setup & Intelligence. لا يدعي النظام أنه ينفذ remote Minecraft commands ما لم يوجد بروتوكول موثق لذلك.

## 4. Premium وPayPal

Premium يدار server-scoped. يختار المستخدم السيرفر من My Servers ثم ينتقل إلى Premium الخاص به. الخطط الحالية هي:

| الخطة | السعر المعروض | الاستخدام المقصود |
|---|---:|---|
| Free | 0 دولار شهريًا | صحة السيرفر والإعداد الأساسي |
| Pro | 4.99 دولار شهريًا | Intelligence أعمق، retention، automation وModeration المدفوع |
| Ultimate | 9.99 دولار شهريًا | الشبكات وmulti-instance والتحليلات الأوسع |

الأسعار هي قيم catalog داخل المشروع، ويجب مطابقتها مع PayPal Plans عند إعداد البيئة.

### قاعدة الأمان الأساسية

> لا يكفي الضغط على زر Pro، ولا الرجوع من PayPal، ولا refresh، ولا حالة `trialing` حتى يحصل السيرفر على Premium.

لا يمنح النظام paid entitlement إلا بعد payment proof موثق من PayPal webhook. الحالات التالية لا تفتح Pro بمفردها:

```text
APPROVAL_PENDING
APPROVED
active بدون paymentVerified
trialing بدون paymentVerified
Browser return
Page refresh
```

أما أحداث الدفع المكتملة الموثقة، مثل payment completed events التي يقبلها backend بعد verification، فهي التي يمكن أن تضع `metadata.paymentVerified = true`.

### ما تم إصلاحه في زر Pro

تم إصلاح عدة أسباب كانت تجعل الزر يظهر `Checkout unavailable` أو يعيد رسالة عامة:

| المشكلة | الإصلاح |
|---|---|
| الواجهة تقرأ `plans` ككائن بينما endpoint يعيدها كمصفوفة | دعم الشكل الصحيح والتحقق من كل plan |
| وجود Pro فقط كان يُحجب بسبب غياب Ultimate | Pro أصبح قابلًا للشراء وحده |
| خطأ PayPal كان يظهر كرسالة عامة | إظهار سبب provider وdebug ID الآمن عند توفره |
| فشل التسجيل Audit كان قد يخفي نجاح checkout | Audit أصبح غير جوهري بالنسبة لرابط PayPal |
| طلب PayPal كان يحتاج response واضحًا | إضافة `Prefer: return=representation` |
| تكرار الطلبات أو header غير مناسب | استخدام UUID قياسي في `PayPal-Request-Id` |
| فشل provider غير محدد المرحلة | إضافة مرحلة `create_subscription` |
| اشتراك trialing بلا دفع كان يفتح Pro بعد refresh | العودة إلى Free مع `payment_pending` |

إذا ظهرت رسالة مثل:

```text
فشل PayPal في مرحلة create_subscription
```

فهذا يعني أن الواجهة وصلت إلى backend، لكن PayPal رفض إنشاء الاشتراك أو لم يعُد provider response صالحًا. يجب عندها فحص PayPal Environment وClient credentials وPlan ID وحالة الخطة داخل نفس Sandbox أو Live.

### Card وGoogle Pay

المشروع لا يخزن أرقام البطاقات أو CVV. Card وGoogle Pay هما provider-mediated methods، وتوفرهما لا يعني أنهما يعملان تلقائيًا في كل بلد أو حساب أو متصفح. يجب أن يسمح PayPal بهما، وأن تكون flags والـprovider capability صحيحة.

## 5. Minecraft Plugin: ماذا يفعل؟

الـMinecraft Plugin هو الجسر الذي يربط خادم Bukkit/Spigot/Paper بالـDashboard. لا يقوم plugin بتخمين بيانات اللاعبين، بل يرسل الأحداث التي تحدث فعليًا داخل الخادم.

### ما يرسله Plugin

من أمثلة telemetry:

```text
heartbeat
player_count
player_join
player_leave
```

كل طلب محمي بآلية توقيع وbearer/HMAC/timestamp/nonce حسب بروتوكول المشروع. backend يتحقق من الطلب، يمنع malformed payload، ويرفض nonce المكرر.

### ماذا يحدث عند التشغيل؟

عند تثبيت JAR ووضع config.yml الصحيح، يستطيع Plugin:

1. قراءة إعدادات backend والـinstance.
2. إنشاء اتصال مصادق.
3. إرسال snapshot أو player count.
4. إرسال heartbeat دوري.
5. إرسال player join وleave عند حدوثها.
6. تمكين Dashboard من عرض حالة الاتصال والبيانات المقاسة.

وجود heartbeat يثبت أن الخادم متصل مؤخرًا، لكنه لا يثبت وحده retention أو player journey أو comparison window.

### التوافق والإصدارات

الـJAR مبني على Bukkit/Spigot API compatibility وJava 8 bytecode. الهدف هو عائلة:

```text
Spigot / Paper / Bukkit-compatible
1.8.x
1.12.x
1.16.x
1.20.x
1.21.x
```

> **تنبيه مهم:** PocketMine-MP/Bedrock ليس ضمن هذا artifact. كما أن compile/package الناجح لا يساوي runtime certification لكل إصدار. يلزم تشغيل خوادم Spigot/Paper فعلية لكل إصدار تريد اعتماده تجاريًا.

### ملفات Plugin

| الملف | الغرض |
|---|---|
| `plugin/target/promcbot-plugin-0.1.0.jar` | ناتج Maven المحلي |
| `deliverables/ProMcBot-0.1.0-Universal-Bukkit.jar` | artifact قابل للتنزيل |
| `plugin.yml` | تعريف Plugin وأوامره وmain class |
| `dev/promcbot/plugin/ProMcBotPlugin.class` | main class داخل JAR |

الـJAR الحالي مفحوص بJava major version 52، أي Java 8 bytecode.

### طريقة الاستفادة من Plugin

صاحب السيرفر يثبت Plugin في مجلد `plugins`، يضع config الذي يولده Dashboard، يعيد تشغيل الخادم، ثم يراجع Activation. بعد ذلك يجب إبقاء الخادم متصلًا وتشغيل لاعبين حقيقيين حتى تصل بيانات joins/leaves/counts. بدون ذلك ستبقى بعض بطاقات Intelligence وStats في حالة insufficient data، وهذا سلوك صحيح.

## 6. ماذا تستفيد السيرفرات من النظام؟

### الفائدة الإدارية

بدل أن يبحث صاحب السيرفر في سجلات متعددة أو يختبر أوامر يدوية، يحصل على مساحة واحدة تعرض حالة الخادم، اتصال الـPlugin، إعدادات Minecraft، حالة Bot، Modules، Moderation، Premium، والتنبيهات.

### الفائدة التشغيلية

يعرف صاحب السيرفر هل:

- الـBot مثبت في guild.
- المستخدم يملك صلاحية الإدارة فعلًا.
- Plugin أرسل heartbeat حديثًا.
- عدد اللاعبين مقاس أم غير متوفر.
- Intelligence لديها data كافية.
- Moderation متاح ضمن الخطة.
- PayPal مهيأ أم لا.

### الفائدة التحليلية

بعد جمع telemetry كافية، يمكن تحويل الأحداث إلى مؤشرات تساعد على فهم النشاط، joins/leaves، player count، وفروق instances. هذه التحليلات ليست بديلًا عن نظام ألعاب كامل أو قاعدة بيانات player profiles شاملة، لكنها طبقة مراقبة وتحليل تشغيلية مفيدة.

### الفائدة الأمنية

الصلاحيات لا تعتمد على زر الواجهة فقط. يتم تطبيق access guards وbot membership وPremium entitlement في backend وruntime. كما لا يتم منح Premium من redirect أو refresh، ولا يتم نشر raw player identity في Stats العامة.

### الفائدة التسويقية والعامة

Public Stats وDiscord Stats Card يعطيان السيرفر صفحة مشاركة عامة compact. Profile العام يعرض Discord public identity فقط، ولا يدعي XP أو ranking غير موجودين في schema الحالي.

## 7. تجربة تخيلية: أنا صاحب سيرفر كبير

سأتخيل أنني صاحب شبكة Minecraft كبيرة، ولي عدة سيرفرات Discord، وأريد تجربة ProMcBot لأول مرة.

### الخطوة الأولى: الدخول

أسجل الدخول عبر Discord OAuth. لا أرى 100 سيرفر دخلتها كعضو؛ أرى فقط السيرفرات التي أملك فيها Owner أو Administrator. هذا يقلل التشويش ويمنع تعديل سيرفرات لا أديرها.

### الخطوة الثانية: اختيار السيرفر

أختار سيرفرًا واحدًا، فأرى banner أو icon أو fallback color، وأدخل إلى Overview. الـsidebar يصبح خاصًا بالسيرفر: Overview، Configuration، Intelligence، Action Center، Modules، Moderation، Audit، Premium، ثم Back to My Servers.

### الخطوة الثالثة: إعداد Minecraft

أدخل IP وport في Configuration، ثم أذهب إلى Intelligence. الصفحة لا تطلب مني اختيار سيرفر آخر؛ تعرض السيرفر الذي فتحته فقط. أضغط Generate عندما يكون provisioning مهيأً، أضع config في Minecraft، وأثبت JAR.

### الخطوة الرابعة: التحقق

بعد تشغيل الخادم، أراجع Activation. إذا ظهر heartbeat، أعرف أن الاتصال الأساسي يعمل. إذا لم تظهر player analytics، لا أعتبر ذلك عطلًا فورًا؛ أتأكد من وجود لاعب فعلي وإرسال join/leave/count events.

### الخطوة الخامسة: Moderation

إذا كنت على Free، أرى أن Moderation advanced يتطلب Pro، والزر مقفل. إذا كنت على Pro موثق الدفع، تصبح الأوامر والواجهة متاحة. إذا حاولت تجاوز الواجهة، يرفض backend العملية أيضًا.

### الخطوة السادسة: Action Center

لا أرى أزرارًا وهمية مثل Execute remote command دون بروتوكول. أرى evidence وثقة ومقارنة زمنية. إذا لم توجد بيانات كافية، يخبرني النظام بأن أبقي Plugin متصلًا وأجمع telemetry.

### الخطوة السابعة: Premium

أختار Pro. إذا كانت PayPal Sandbox صحيحة، ينتقل المتصفح إلى PayPal. إذا فشل إنشاء الاشتراك، تظهر مرحلة `create_subscription` أو سبب PayPal الآمن. لا يحصل السيرفر على Pro بسبب الضغط أو refresh. بعد الدفع ووصول webhook موثق، تتغير entitlement إلى Pro.

### تقييمي كصاحب سيرفر

أعتبر النظام مفيدًا إذا كان هدفي هو جمع Discord management وMinecraft telemetry وModeration وPremium في لوحة واحدة. أعتبره غير مكتمل تجاريًا في النقاط التي تحتاج تشغيلًا خارجيًا، مثل PayPal Live، DNS الخاص بـ`stats.promcbot.dev`، واختبار runtime لكل إصدار Minecraft. هذه ليست أخطاء مخفية؛ النظام يعرضها كمتطلبات خارجية صريحة.

## 8. ما الذي تم تغييره في كل جزء؟

### تغييرات Bot

تم إصلاح membership guard، حصر workspace، روابط Premium server-scoped، AutoMod defaults، emoji aliases، runtime Pro gate، blacklist parser، ومخرجات الأوامر. أضيف أيضًا Public Stats Card إلى أمر `/stats` بدل إنشاء أمر مكرر بلا حاجة.

### تغييرات Dashboard/backend

تم تحويل صفحات عديدة إلى server-scoped، تحسين My Servers، إضافة bot fetch عند cache miss، banner/icon fallback، settings IP/port، Activation evidence، Intelligence catalog، Action Center evidence، Moderation API، Premium plan readiness، PayPal diagnostics، Public Stats/Profile، وrunbook للدومين.

### تغييرات Plugin

تم بناء artifact Universal Bukkit على Java 8 bytecode، وتحسين مسار heartbeat/snapshot والـtelemetry، وإضافة event IDs ثابتة لجعل retry idempotent، والتحقق من التوقيع والnonce، وإتاحة config generation بأسطر YAML فعلية بدل `\\n` حرفية. أصبح final flush عند shutdown best-effort ومحدودًا زمنيًا، مع تسجيل الفقد المحتمل لأن queue الذاكرية لا يمكن ضمانها بعد إيقاف الخادم.

### ما لم يُعدّل

بناءً على القيد المعتمد، لم يتم تعديل:

```text
dash/dashboard/pages/logs.html
bot/Models/**
main branch
```

## 9. ما هو جاهز وما يحتاج خطوة خارجية؟

| العنصر | الحالة | التفسير |
|---|---|---|
| Bot commands وaccess guards | جاهز برمجيًا | يحتاج Discord حيًا للاختبار النهائي |
| Dashboard routes وserver scoping | جاهز برمجيًا | يحتاج deployment حديث |
| Premium entitlement security | جاهز ومختبر | يحتاج PayPal webhook حقيقي لإكمال الدفع |
| PayPal Sandbox checkout | يحتاج إعدادًا خارجيًا | Client ID وSecret وPlan ID وWebhook يجب أن تكون متطابقة |
| Card/Google Pay | provider-dependent | تحتاج تفعيل PayPal والحساب والمنطقة والمتصفح |
| Minecraft JAR | مبني ومتاح | runtime acceptance لكل إصدار يحتاج خادمًا فعليًا |
| Activation intelligence | evidence-based | يحتاج Plugin وMongo وplayers ووقت جمع بيانات |
| Public Stats | الكود جاهز | يحتاج deployment وtelemetry حديثة |
| `stats.promcbot.dev` | جزئي خارجيًا | DNS يحل، لكن 525 يحتاج إصلاح Origin SSL/Cloudflare |
| Logs وModels | محفوظان دون تعديل | القيد احترم بالكامل |

## 10. الاختبارات والحالة الحالية

تم تشغيل الاختبارات المحلية بعد Master 1.6 وmerge تغييرات public profile:

```text
npm test: 96/96 PASS
npm run check: PASS
git diff --check: PASS
JavaScript syntax checks: PASS
Maven clean package: PASS
JAR bytecode: major version 52 (Java 8)
```

آخر commits Master 1.6 الموثقة في الفرع الافتراضي عند إعداد هذا الملف هي:

```text
2dd545ee7 Harden Master 1.6 runtime boundaries
cea140221 Make legacy command compatibility explicit
8d43934f9 Document Master 1.6 execution result
489246fd4 Refresh verified plugin artifact
```

في آخر closeout push تطابق local وremote وأصبح `ahead/behind = 0/0`؛ استخدم `git rev-parse HEAD` لاستخراج SHA الحالي على الفرع.

الفرع هو:

```text
copilot/update-bot-design-and-translation-system
```

الـhealth المنشور لـ`promcbot.dev` أعاد HTTP 200. أما `stats.promcbot.dev` فكان DNS يحل، لكن HTTPS يعيد Cloudflare 525 بسبب Origin SSL، وهي خطوة خارجية تحتاج ضبط Railway/Cloudflare. كما أزيل الرسم الزخرفي غير المقاس من صفحة Public Stats، وأصبحت صفحة الإحصاءات تعرض aggregates المستلمة فقط.

## 11. الخلاصة النهائية

ProMcBot ليس مجرد Discord Bot ولا مجرد Dashboard. هو نظام ثلاثي الطبقات:

1. **Discord Bot** للتفاعل والأوامر والحماية والـModeration والروابط العامة.
2. **Dashboard/backend** للإدارة المركزية والـserver scoping والـIntelligence والـPremium والـStats.
3. **Minecraft Plugin** لإرسال الحقائق التشغيلية من الخادم الحقيقي إلى النظام.

القيمة الأساسية للسيرفر هي أن هذه الطبقات تعمل معًا: صاحب السيرفر يعرف من يملك الصلاحية، وهل الـBot موجود، وهل Minecraft متصل، وهل البيانات كافية، وما الذي يمكن تفعيله ضمن الخطة، دون الاعتماد على metrics وهمية أو صلاحيات غير موثقة.

لكن يجب التفريق بين **جاهزية الكود** و**جاهزية التشغيل الخارجي**. PayPal Live، DNS، MongoDB، Discord credentials، Plugin provisioning، وتشغيل خوادم Minecraft حقيقية هي إعدادات لا يمكن للمستودع اختراعها. لذلك أفضل وصف للحالة الحالية هو: النظام جاهز للمراجعة والتجربة المنظمة، مع متطلبات خارجية واضحة قبل الإنتاج الكامل.

## المراجع داخل المشروع

[1]: `PRO_MCBOT_FINAL_MASTER_RESULT.md` — التقرير التنفيذي الكامل والتفاصيل المثبتة.
[2]: `PRO_MCBOT_BILLING.md` — إعداد PayPal وقواعد الدفع والـwebhook.
[3]: `PRO_MCBOT_PREMIUM.md` — إعداد Premium والخطط والبيئة.
[4]: `docs/PUBLIC_STATS_RUNBOOK.md` — ربط `stats.promcbot.dev` عبر Railway وDNS وCloudflare.
[5]: `deliverables/ProMcBot-0.1.0-Universal-Bukkit.jar` — artifact الخاص بـMinecraft Plugin.
[6]: `plugin/target/promcbot-plugin-0.1.0.jar` — ناتج Maven المحلي.

## مراجع PayPal الرسمية

[7]: https://developer.paypal.com/subscriptions/integrate — PayPal Subscriptions integration.
[8]: https://raw.githubusercontent.com/paypal/paypal-rest-api-specifications/main/openapi/billing_subscriptions_v1.json — PayPal Subscriptions OpenAPI specification.
