# 🚀 Railway Deployment Guide — ProMcBot

## متطلبات Railway (Variables)

أضف هذه المتغيرات في Railway → Project → Variables:

| Variable              | القيمة                                                          | ملاحظة                                      |
|-----------------------|----------------------------------------------------------------|---------------------------------------------|
| `BOT1_1_TOKEN`        | توكن البوت الرئيسي                                              | من Discord Developer Portal                 |
| `MONGO_URL`           | رابط MongoDB Atlas                                             | نفس الرابط في .env                          |
| `PREFIX`              | `!`                                                             | بادئة الأوامر                              |
| `OWNER_ID`            | معرف حسابك الـ Discord                                         | يمنح صلاحية Admin                          |
| `GuildID`             | معرف السيرفر الرئيسي                                           | لتسجيل الـ slash commands                  |
| `SLASH_GLOBAL`        | `true`                                                          | تفعيل الأوامر العامة                       |
| `NODE_ENV`            | `production`                                                    | **مهم**                                     |
| `BOT_ONLY`            | `false`                                                         | لتشغيل الداشبورد معاً                      |
| `DISCORD_CLIENT_ID`   | `1220005260857311294`                                           | من Discord OAuth2 App                      |
| `DISCORD_CLIENT_SECRET` | Secret من Discord App                                         | من Discord Developer Portal → OAuth2       |
| `SESSION_SECRET`      | نص عشوائي طويل (32+ حرف)                                       | مثال: اجعله عشوائياً                       |
| `CALLBACK_URL`        | `https://YOUR-DOMAIN.railway.app/auth/discord/callback`         | عدّل الدومين الخاص بك                      |
| `CUSTOM_DOMAIN`       | `promcbot.qzz.io` (اختياري)                                    | إذا عندك دومين مخصص                        |

## خطوات الرفع على Railway

### 1. إعداد Discord OAuth
1. افتح [Discord Developer Portal](https://discord.com/developers/applications)
2. اختر تطبيقك → **OAuth2**
3. أضف Redirect URL:
   ```
   https://YOUR-DOMAIN.railway.app/auth/discord/callback
   ```

### 2. رفع على Railway
```bash
# تأكد من تثبيت Railway CLI أو ارفع من GitHub
railway login
railway up
```

أو من الـ dashboard:
1. اربط المشروع بـ GitHub repository
2. Railway سيبني تلقائياً من `Dockerfile`
3. أضف المتغيرات في Variables

### 3. التحقق من التشغيل
```
https://YOUR-DOMAIN.railway.app/health
```
يجب أن يرجع:
```json
{ "status": "ok", "uptime": 123.4 }
```

## هيكل المشروع بعد التحديث

```
mybott/
├── server.js          ← نقطة البداية (يشغّل البوت والداشبورد)
├── railway.toml       ← إعدادات Railway
├── Dockerfile         ← بناء الـ container
├── .dockerignore      ← استثناء الملفات غير الضرورية
├── package.json
├── bot/               ← كود البوت Discord
│   ├── index.js
│   ├── Commands/
│   ├── api/           ← Bot REST API
│   └── ...
└── dash/              ← الداشبورد الويب
    ├── index.js       ← Express routes
    └── dashboard/
        ├── shared.css ← CSS موحد لكل الصفحات
        ├── shared.js  ← JS موحد (sidebar, theme, auth)
        ├── home.html  ← الصفحة الرئيسية
        ├── dashboard.html ← صفحة البروفايل
        └── pages/     ← باقي الصفحات
```

## استكشاف الأخطاء

### الداشبورد لا يعمل
- تأكد `BOT_ONLY=false`
- تحقق من `CALLBACK_URL` يطابق Railway domain

### البوت لا يتصل
- تحقق من `BOT1_1_TOKEN` صحيح
- تحقق من `MONGO_URL` يعمل

### OAuth لا يعمل
- تأكد Redirect URL مضاف في Discord OAuth2
- تأكد `DISCORD_CLIENT_SECRET` صحيح
