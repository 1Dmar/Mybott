# ProMcBot Public Profile Username

## الاستخدام

من صفحة Dashboard الرئيسية، يفتح المستخدم بطاقة **Public profile link**، يكتب username من 3 إلى 32 حرفًا باستخدام الحروف الإنجليزية الصغيرة والأرقام والنقطة والشرطة السفلية أو الشرطة العادية، ثم يضغط **Save username**. الاسم يُحفظ في `UserProfile` مع تحقق من الصيغة ومنع الأسماء المحجوزة والتأكد من عدم استخدامه لحساب آخر.

بعد الحفظ يصبح الرابط الأساسي:

```text
https://promcbot.dev/u/<username>
```

ويظهر زر **Open public card** لفتح البطاقة مباشرة. الرابط القديم `/profile/<id>` يبقى redirect للتوافق فقط، بينما `/u` هو المسار canonical.

## محتوى البطاقة العامة

تعرض صفحة البطاقة العامة اسم Discord العام، username العام، avatar، Discord handle، **Member since**، وProfile ID، مع زر نسخ الرابط. يظهر تاريخ **Member since** كتاريخ إنشاء حساب Discord المستنتج من snowflake الخاص بالمستخدم؛ وهو ليس تاريخ الانضمام إلى سيرفر. أسفل الصفحة يظهر attribution بتصميم خفيف يستخدم ملف الشعار الرسمي نفسه الموجود في الـ navbar، مع حقوق النشر.

لا تعرض البطاقة عضويات السيرفرات الخاصة، أسماء اللاعبين، raw activity، أو بيانات غير عامة. إذا لم يحدد المستخدم username، يمكن فتح البطاقة باستخدام Discord user ID عبر `/u/<id>`.

## نقاط API

| المسار | الوظيفة |
|---|---|
| `PATCH /api/user/profile` | حفظ username للمستخدم المصادق عليه. |
| `GET /api/user/profile` | إرجاع username المحفوظ والرابط العام للوحة Dashboard. |
| `GET /api/public/profile/:identifier` | حل username المحفوظ أو Discord user ID وإرجاع البطاقة العامة الآمنة. |
| `GET /api/public/profile-card-v2/:identifier` | توليد صورة PNG بقياس 1536×1024 باستخدام template الصورة المعتمد؛ تتغير فقط الصورة والاسم والusername وتاريخ العضوية وعددا Followers وLikes. |
| `GET /u/:identifier` | عرض صفحة البطاقة العامة مع `og:image` وTwitter metadata ديناميكية. |
| `GET /profile/:identifier` | redirect توافق إلى `/u/:identifier`. |

## ملاحظات التشغيل

يجب أن يكون bot قادرًا على جلب Discord user ID المرتبط بالusername المحفوظ حتى تُعرض الهوية الحالية والصورة من Discord. الحفظ نفسه يعتمد على قاعدة البيانات، لذلك يبقى username فريدًا حتى لو لم يكن الاسم ظاهرًا في cache. أسماء المسارات مثل `admin` و`api` و`profile` و`stats` و`u` و`premium` محجوزة ولا يمكن claim لها. عند إرسال الرابط في Discord، يقرأ Discord metadata من `/u/<username>` ثم يطلب صورة `/api/public/profile-card-v2/<username>`؛ البطاقة تستخدم template ثابتًا بنسبة 3:2 بقياس 1536×1024، ولا يتغير فيها إلا avatar والاسم والusername وتاريخ العضوية وعددا Followers وLikes. وصف المعاينة يعرض username وعدد الإعجابات فقط. يجب أن يكون النطاق العام متاحًا عبر HTTPS، وقد تحتاج معاينة Discord نفسها إلى إعادة إرسال الرابط إذا كانت محفوظة محليًا.

## Visual QA

The mobile public profile render uses the same fixed homepage shell: hamburger, ProMcBot logo, theme control, account avatar, sidebar-backed main window spacing, and responsive card layout. The theme control is shared with Dashboard through `pmcbot_theme`; in Light Mode the public identity card, statistics, sharing panel, text, borders, and footer switch to high-contrast light tokens rather than retaining the dark blue hard-coded treatment.

The generated Discord/Open Graph card is a 1200×630 PNG with a modern dark glass composition, luminous avatar ring, and the official ProMcBot logo clipped to a circle in the upper-right beside `Powered by ProMcBot`. The only profile-specific values rendered in the image are display name, `@username`, avatar, and the Discord account-creation month/year. The former top-left logo/label, custom status, generic marketing sentence, and lower watermark are intentionally absent.

## Social profile actions

Authenticated visitors can follow or unfollow a public profile and like or unlike it directly from the public `/u/<username>` page. Each action is idempotent: a compound unique index allows one follow and one like per authenticated account and target profile, so repeated clicks cannot inflate the counters. Mutations require a valid authenticated session, resolve the target through the connected Discord profile, reject following yourself, and are limited to 30 mutation requests per minute per client address.

On a successful new Discord OAuth login, the dashboard creates an idempotent follow record for profile owner `804999528129363998`. This does not create duplicates and is skipped safely when the database is unavailable; it also never forces the owner to follow their own profile.

Follower and like totals remain available on the public web page and are also rendered as aggregate `Followers` and `Likes` values inside the metadata image for community use. The public page exposes only aggregate counts and the viewer’s own boolean state; it does not expose follower identities, liker identities, private guild membership, or raw activity.

## إشعار تسجيل الدخول عبر Discord OAuth2

عند نجاح تسجيل الدخول عبر Discord OAuth2، يرسل Dashboard رسالة Embed بنفس تنسيق `main` إلى Webhook Discord. لا يتم وضع رابط الـ Webhook أو token داخل ملفات المشروع؛ يجب ضبط أحد الخيارات التالية في Railway: `DISCORD_OAUTH_LOGIN_WEBHOOK_URL` كرابط كامل، أو `WEBHOOK_ID` مع `WEBHOOK_TOKEN`.

الإشعار يتضمن اسم المستخدم، Discord user ID، وتاريخ تسجيل الدخول، مع الصورة المصغرة إذا كانت صورة Discord متاحة. الإرسال غير متزامن ومحدود بثماني ثوانٍ، لذلك لا يفشل تسجيل الدخول إذا كان Discord Webhook متوقفًا أو بطيئًا. يتم تعطيل الإشعار تلقائيًا إذا لم تكن متغيرات البيئة موجودة أو كان الرابط غير صالح.
