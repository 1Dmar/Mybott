# ProMcBot quick start

هذا هو المسار الصحيح للسيرفر الذي تريد منه بيانات Minecraft ولاعبين وأوامر remote. **IP وport وحدهما لا يربطان Minecraft بالـDashboard**؛ يمكن حفظ العنوان كمعلومة اختيارية، لكن البيانات الغنية تأتي من ProMcBot Paper plugin.

## المسار المختصر

| المرحلة | ما تفعله | علامة النجاح |
|---|---|---|
| 1. اختر السيرفر | افتح `/myservers` واختر سيرفرًا يظهر لك فيه `Owner` أو `Administrator` أو `Manage Server` | تفتح صفحة `Server overview` |
| 2. افتح الإعداد | من sidebar اختر `Setup & intelligence` | ترى `Activation` و`Connection health` |
| 3. ولّد الإعداد | اكتب Instance ID مثل `primary` واضغط `Generate one-time config` | يظهر لك block بصيغة `config.yml` مرة واحدة |
| 4. ثبّت الـplugin | ضع JAR الخاص بـProMcBot داخل مجلد `plugins/` في Paper server، ثم أعد تشغيل Paper | يظهر plugin في startup بدون خطأ configuration |
| 5. الصق الإعداد | الصق block الناتج في `plugins/ProMcBot/config.yml`، ولا تشاركه أو تضعه في Git | يحتوي الملف على `backend.base-url` و`server-id` و`instance-id` و`access-token` و`signing-secret` |
| 6. افحص الاتصال | بعد restart نفّذ `/promcbot status` من console أو داخل اللعبة | ترى حالة backend والـqueue والقدرات دون ظهور secrets |
| 7. انتظر القياس | ارجع إلى Dashboard واضغط refresh وانتظر heartbeat؛ نفّذ join/leave أو انتظر snapshots | تتحول خطوات heartbeat/telemetry إلى `Ready` وتظهر الأرقام المقاسة |

## بناء الـJAR من المستودع

إذا لم يكن لديك JAR جاهز، تحتاج Java 21 ثم تنفذ:

```bash
cd plugin
mvn clean test package
```

بعد نجاح البناء استخدم artifact الموجود في `plugin/target/` داخل مجلد Paper `plugins/`. لا ترفع `config.yml` الحقيقي أو أي access token أو signing secret إلى GitHub.

## ماذا يعرض كل جزء؟

`Server overview` يجمع الحالة من Discord runtime وPluginInstance وTelemetryEvent وentitlement وGuildSettings في عقد Overview واحد. لذلك لا يعرض رقمًا غير موجود؛ إذا لم يصل heartbeat أو telemetry فستظهر `Not connected` أو `Not measured` بدل رقم وهمي.

`Modules` يقرأ إعدادات البوت من `BotConfig`. يمكنك تشغيل أو إيقاف Auto responder وWelcome messages وModeration وAudit logging وTickets وServer status من هناك. أما `Minecraft plugin` فليس toggle؛ هو اتصال حقيقي ويظل `Not connected` حتى يسجل plugin heartbeat.

`Audit` يقرأ من `/api/guilds/:guildId/audit` ويعرض سجلات `AuditLog` الفعلية. إذا كانت القائمة فارغة فهذا يعني أنه لم يسجل نشاط بعد، وليس أن الصفحة فشلت.

## إذا بقيت البيانات فارغة

إذا كانت خطوة Discord غير مكتملة، فتأكد أن البوت موجود في السيرفر وأنه يستطيع رؤيته. إذا كان plugin غير provisioned، ولّد config من Setup. إذا كان provisioned لكن heartbeat غير حديث، افحص `base-url` و`server-id` و`instance-id` ووجود JAR ثم شغّل `/promcbot status`. إذا كان heartbeat موجودًا ولا توجد player metrics، انتظر snapshot أو نفّذ join/leave؛ القياسات لا تُخترع من IP وport.

إذا ظهر `plugin_provisioning_not_configured` فإعداد الخادم ينقصه `PLUGIN_ENCRYPTION_KEY`. وإذا كانت صفحة Dashboard تعيد `guild_access_required` فالحساب الحالي لا يملك صلاحية إدارة ذلك Guild، حتى لو كان قد دخل السيرفر فقط.

> **قاعدة الأمان:** الإعداد الناتج one-time secret. خزّنه في Paper فقط، ولا تضعه في رسالة Discord أو issue أو repository. تغيير السر يتطلب revoke/provision جديدًا من مسار الإدارة المناسب.
