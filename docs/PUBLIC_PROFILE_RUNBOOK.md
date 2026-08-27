# ProMcBot Public Profile Username

## الاستخدام

من صفحة Dashboard الرئيسية، يفتح المستخدم بطاقة **Public profile link**، يكتب username من 3 إلى 32 حرفًا باستخدام الحروف الإنجليزية الصغيرة والأرقام والنقطة والشرطة السفلية أو الشرطة العادية، ثم يضغط **Save username**. الاسم يُحفظ في `UserProfile` مع تحقق من الصيغة ومنع الأسماء المحجوزة والتأكد من عدم استخدامه لحساب آخر.

بعد الحفظ يصبح الرابط الأساسي:

```text
https://promcbot.dev/u/<username>
```

ويظهر زر **Open public card** لفتح البطاقة مباشرة. الرابط القديم `/profile/<id>` يبقى redirect للتوافق فقط، بينما `/u` هو المسار canonical.

## محتوى البطاقة العامة

تعرض البطاقة اسم Discord العام، username العام، avatar، Discord handle، Profile ID، مصدر البيانات، وحالة الخصوصية. وتحتوي على زر نسخ الرابط. في أسفل الصفحة يظهر attribution واضح: **ProMcBot** مع حرف **P** بدون خلفية، إضافة إلى حقوق النشر.

لا تعرض البطاقة عضويات السيرفرات الخاصة، أسماء اللاعبين، raw activity، أو بيانات غير عامة. إذا لم يحدد المستخدم username، يمكن فتح البطاقة باستخدام Discord user ID عبر `/u/<id>`.

## نقاط API

| المسار | الوظيفة |
|---|---|
| `PATCH /api/user/profile` | حفظ username للمستخدم المصادق عليه. |
| `GET /api/user/profile` | إرجاع username المحفوظ والرابط العام للوحة Dashboard. |
| `GET /api/public/profile/:identifier` | حل username المحفوظ أو Discord user ID وإرجاع البطاقة العامة الآمنة. |
| `GET /api/public/profile-card/:identifier` | توليد صورة PNG بقياس 1200×630 لاستخدامها في Discord/Open Graph. |
| `GET /u/:identifier` | عرض صفحة البطاقة العامة مع `og:image` وTwitter metadata ديناميكية. |
| `GET /profile/:identifier` | redirect توافق إلى `/u/:identifier`. |

## ملاحظات التشغيل

يجب أن يكون bot قادرًا على جلب Discord user ID المرتبط بالusername المحفوظ حتى تُعرض الهوية الحالية والصورة من Discord. الحفظ نفسه يعتمد على قاعدة البيانات، لذلك يبقى username فريدًا حتى لو لم يكن الاسم ظاهرًا في cache. أسماء المسارات مثل `admin` و`api` و`profile` و`stats` و`u` و`premium` محجوزة ولا يمكن claim لها. عند إرسال الرابط في Discord، يقرأ Discord metadata من `/u/<username>` ثم يطلب صورة `/api/public/profile-card/<username>`؛ لذلك يجب أن يكون النطاق العام متاحًا عبر HTTPS، ويجب إعادة إرسال الرابط أو انتظار تحديث cache إذا كان Discord قد حفظ معاينة قديمة.

## Visual QA

The mobile public profile render uses the same fixed homepage shell: hamburger, ProMcBot logo, theme control, account avatar, sidebar-backed main window spacing, and responsive card layout. The generated Discord card is a 1200×630 PNG with a blue/violet glass gradient, stars, avatar ring, display name, `@username`, Discord handle, user ID, and a borderless `P` plus `© ProMC Bot` attribution.
