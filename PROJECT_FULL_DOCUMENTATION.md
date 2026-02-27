# شرح المشروع الكامل (Admin Dashboard + Website)

## 1) نظرة عامة
هذا المشروع عبارة عن منصة إدارة محتوى (CMS) مخصصة لموقع مركز طبي، وتتكوّن من:
- موقع عام `website/` للزوار.
- لوحة تحكم إدارية `admin/` لإدارة المحتوى والمقالات والوسائط.
- خادم Node.js/Express يقدم الصفحات وواجهات API.
- تخزين بيانات محلي بملفات JSON داخل `data/` (بدون قاعدة بيانات SQL/Mongo).

الهدف الأساسي: تعديل محتوى الموقع ونشره مباشرة بدون تعديل الكود في كل مرة.

## 2) المعمارية التقنية
- Backend: `Node.js + Express`
- Session/Auth: `express-session` مع `connect-redis` و Redis
- Security: `helmet`, `csurf`, `express-rate-limit`
- Uploads: `multer`
- Storage: ملفات JSON في `data/`
- Static Serving: صفحات `website/` و `admin/` و `uploads/`

ملف التشغيل الرئيسي: `server.js`

## 3) هيكل المشروع
- `server.js`: تهيئة السيرفر، الجلسات، الميدلوير، ربط الـ routes، health check.
- `routes/public.js`: مسارات الموقع العام + API للمحتوى والمقالات ونموذج التواصل.
- `routes/auth.js`: تسجيل الدخول/الخروج، فحص الجلسة، تحديث بيانات الدخول.
- `routes/admin.js`: API الإدارة (المحتوى، المقالات، رفع الصور/الفيديو، النشر، الاستعادة، الاتصالات).
- `middleware/auth.js`: حماية المسارات الإدارية عبر الجلسة.
- `middleware/errorHandler.js`: 404 و معالجة أخطاء API/الرفع/CSRF.
- `lib/config.js`: كل إعدادات البيئة ومسارات الملفات.
- `lib/contentStore.js`: إدارة محتوى draft/published والنسخ الاحتياطية له.
- `lib/postStore.js`: إدارة المقالات draft/published والنسخ الاحتياطية لها.
- `lib/userStore.js`: إدارة المستخدم الإداري وتحديث كلمة المرور/اسم المستخدم.
- `lib/validation.js`: التحقق والتنظيف لكل مدخلات API.
- `lib/security.js`: CSP + Rate Limiters + حجب المسارات الحساسة.
- `lib/contactRouter.js`: توجيه رسائل التواصل (Email/URL/WhatsApp/None).
- `lib/audit.js`: سجل تدقيق للأحداث الحساسة `data/audit.log`.
- `backup.js` و `restore.js`: نسخ واستعادة المشروع (data + uploads).
- `website/`: واجهة الزوار.
- `admin/`: صفحات الإدارة (`login.html`, `dashboard.html`, `content.html`, `referral.html`).
- `uploads/`: الوسائط المرفوعة.
- `data/`: مخزن البيانات الفعلي.

## 4) دورة البيانات (Draft/Published)
المحتوى يعمل بنمط مرحلتين:
- Draft: التعديلات تحفظ في `data/content.json`.
- Published: النسخة الظاهرة للزوار تحفظ في `data/content.published.json`.

نفس الفكرة للمقالات:
- Draft: `data/posts.json`
- Published: `data/posts.published.json`

عند الحفظ/النشر يتم إنشاء backup تلقائي بملفات timestamp داخل `data/` مثل:
- `content.draft.backup.*.json`
- `content.published.backup.*.json`
- `posts.draft.backup.*.json`
- `posts.published.backup.*.json`

## 5) نظام المصادقة والجلسات
- تسجيل الدخول عبر `POST /login`.
- التحقق من كلمة المرور باستخدام `bcrypt.compare`.
- عند النجاح يتم إنشاء جلسة وتخزين `userId` داخل `req.session`.
- Store للجلسات: Redis.
- إذا Redis غير متاح، النظام يعلن `sessionReady=false` ويرجع 503 لمسارات المصادقة الحساسة.

كوكي الجلسة:
- `httpOnly: true`
- `sameSite: strict`
- `secure` في الإنتاج
- الاسم: `cancercenter.sid`

## 6) الأمان
### Headers/CSP
`helmet` مفعل مع Content Security Policy محدد للمصادر المسموحة (scripts/styles/images/media/frame).

### CSRF
مسارات POST/PUT/PATCH/DELETE الحساسة في الإدارة محمية بـ `csurf()`.

### Rate Limiting
- Login limiter
- Credential update limiter
- Restore limiter
- Contact form limiter

### حماية الملفات الحساسة
`blockSensitivePaths` يمنع الوصول لمسارات مثل:
- `/data`
- `/logs`
- `/.env`
- `/.git`

### Validation/Sanitization
كل payload يخضع لتنظيف نصوص وحدود طول، مع إزالة سكربتات وخصائص خطرة في rich text.

## 7) API العامة (Public)
- `GET /api/public/content`
  - يرجع المحتوى المنشور للموقع العام.

- `GET /api/posts?type=&page=&limit=&search=`
  - قائمة المقالات المنشورة مع Pagination.

- `GET /api/posts/:slug`
  - تفاصيل مقال منشور واحد.

- `POST /api/contacts`
  - استقبال نموذج التواصل بعد validation + rate limit.
  - يحفظ في `data/contacts.json`.
  - يسجل audit event.
  - يمر على `contactRouter` للتوجيه (Email/URL/WhatsApp).

## 8) API الإدارة (Admin)
كلها تحتاج `requireAuth` (إلا login/logout/check).

### مصادقة
- `POST /login`
- `POST /logout`
- `GET /api/auth/check`
- `PUT /api/user/update-credentials` (محمي + CSRF + rate limit)

### المحتوى
- `GET /api/admin/content`
- `POST /api/admin/content` (يحفظ draft)
- `POST /api/admin/publish` (ينشر draft إلى published)
- `GET /api/admin/csrf-token`

### الاتصالات
- `GET /api/admin/contacts?page=&limit=&search=`

### الرفع
- `POST /api/admin/upload` (صور فقط، حد 5MB)
- `POST /api/admin/upload-video` (فيديو، افتراضي 120MB ويمكن تعديله بـ `MAX_VIDEO_UPLOAD_MB`)

### الاستعادة
- `POST /api/admin/restore`
  - يستقبل ملف zip.
  - يستخرج فقط `data/` و `uploads/` بأمان (safe join ضد path traversal).

### المقالات
- `GET /api/admin/posts`
- `GET /api/admin/posts/:slug`
- `GET /api/admin/posts/id/:id`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `PATCH /api/admin/posts/:id/publish`
- `PATCH /api/admin/posts/:id/feature`

## 9) الواجهة الأمامية (Frontend)
يوجد نمطان للواجهة:
- Desktop legacy طويل التمرير: `website/desktop.html`
- Mobile/Tablet: `website/mobile.html` (تنقل موجّه)

### ملفات JS مهمة
- `website/js/app.js`: يربط shell + router + views ويجلب content/posts.
- `website/js/router.js`: توجيه SPA داخلي للمسارات (`/news`, `/updates`, ...).
- `website/js/posts-sections.js`: تحميل وعرض أقسام الأخبار/التحديثات/المقالات مع featured + load more.
- `website/js/post-page.js`: صفحة المقال المفرد (يدعم صورة/فيديو/embed + SEO tags).
- `website/js/language-manager.js`: إدارة اللغة (en/ar) وتحديث المحتوى ديناميكيًا.
- `website/js/attention-guided-nav.js`: تأثيرات تركيز الأقسام وانتقالات لغوية.
- `website/js/scroll-depth-effects.js`: تأثير عمق أثناء التمرير مع احترام reduced motion.
- `website/js/accessibility-manager.js`: تحسينات وصول (keyboard/focus/screen-reader/media preferences).

## 10) التهيئة عبر Environment Variables
أهم المتغيرات:
- `SESSION_SECRET` (إجباري)
- `ADMIN_BOOTSTRAP_USERNAME` (افتراضي: admin)
- `ADMIN_BOOTSTRAP_PASSWORD` (إجباري عند أول تشغيل إذا `users.json` غير موجود)
- `ADMIN_BOOTSTRAP_EMAIL`
- `REDIS_URL` أو (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`)
- `SESSION_MAX_AGE_MS`
- `SITE_URL`
- `PORT`
- `NODE_ENV`
- `MAX_VIDEO_UPLOAD_MB`
- اختياري: `DATA_DIR`, `UPLOADS_DIR`, `BACKUPS_DIR`

## 11) التشغيل المحلي
1. تثبيت الاعتمادات:
```bash
npm install
```

2. تجهيز `.env` انطلاقًا من `.env.example`.

3. تشغيل المشروع:
```bash
npm start
```

روابط مهمة:
- الموقع: `http://localhost:3000/`
- تسجيل دخول الإدارة: `http://localhost:3000/login.html`
- Health: `http://localhost:3000/health`

## 12) النسخ الاحتياطي والاستعادة
### إنشاء نسخة احتياطية
```bash
npm run backup
```
ينشئ ملف zip داخل `backups/` يحتوي `data/` و `uploads/`.

### استعادة آخر نسخة
```bash
npm run restore
```

### استعادة ملف محدد
```bash
node restore.js backups/backup-YYYY-MM-DD-HH-mm.zip
```

## 13) المراقبة والسجلات
- سجلات التطبيق بصيغة JSON عبر `lib/logger.js`.
- سجل التدقيق في: `data/audit.log`.
- `GET /health` يتحقق من:
  - Redis readiness
  - وجود مجلد `data/`
  - وجود مجلد `uploads/`

الحالة ترجع:
- `ok` إذا كل checks سليمة.
- `degraded` إذا جزء غير جاهز.

## 14) ملاحظات تشغيل مهمة
- Redis مطلوب فعليًا للجلسات في بيئة الإنتاج.
- لا ترفع مجلدات `data/` و `uploads/` للعامة.
- في أول تشغيل بدون `users.json` يجب ضبط `ADMIN_BOOTSTRAP_PASSWORD`.
- مسارات admin تعتمد الجلسة وCSRF، وأي استهلاك API من الواجهة يجب أن يجلب CSRF token أولًا عند الحاجة.

## 15) اقتراحات تحسين مستقبلية
- نقل التخزين من JSON إلى DB (PostgreSQL مثلًا) عند نمو البيانات.
- إضافة اختبارات تلقائية (unit/integration) لمسارات API.
- تفعيل mail provider فعلي داخل `lib/mailer.js` بدل الـstub الحالي.
- توحيد بعض سكربتات الواجهة (يوجد أكثر من نظام language/navigation ويحتاج توحيد تدريجي).
- إضافة pipeline للنشر مع فحوصات أمنية تلقائية.

---

## خلاصة سريعة
المشروع CMS متكامل وقابل للإدارة من لوحة التحكم، مع فصل واضح بين draft/published، وأساس أمني جيد (sessions + CSRF + rate-limit + CSP)، ودعم إدارة مقالات ووسائط ونموذج تواصل مع قابلية توسع مستقبلية.
