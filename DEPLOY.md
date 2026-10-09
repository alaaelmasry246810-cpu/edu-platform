# دليل الرفع — خطة مجانية للتجربة (بدون بطاقة ائتمان)

> **للتجربة بس.** الخطة دي مجانية بالكامل، بس ليها حدود (موضحة تحت). لما يبقى فيه طلاب حقيقيين أو اشتراكات مدفوعة، الأنسب سيرفر VPS صغير (~4–6$ في الشهر).
>
> **اتغير إيه عن الخطة القديمة؟** Hugging Face Spaces بقى يطلب اشتراك مدفوع (PRO) لأي Space بـ Docker، وRender بيطلب بطاقة للتحقق مع حسابات كتير، فالـ backend اتنقل لـ **Back4App Containers** (بدون بطاقة). والملفات (فيديوهات، بودكاست، صوت) بقت بتتخزن في **Supabase Storage** لأن هارد الاستضافة المجانية بيتمسح مع كل تشغيل.

| الطبقة | الخدمة | المجاني | الحالة |
|---|---|---|---|
| الواجهة (Next.js) | **Vercel** (Hobby) | 100GB نقل/شهر — للاستخدام غير التجاري | فيه مشروع `edu-platform` موجود في حسابك |
| السيرفر (FastAPI + Docker) | **Back4App Containers** (free) | 256MB رام، ربع معالج، 600 ساعة/شهر، 100GB نقل | الـ Dockerfile جاهز (السيرفر بقى بياخد ~106MB بس) |
| قاعدة البيانات | **Neon** | 0.5GB | موجودة (منطقة `us-east-2`) |
| البحث في المناهج | **Qdrant Cloud** | 1GB | موجود |
| الملفات | **Supabase Storage** | 1GB — أقصى ملف 50MB | اتعمل مشروع `edu-platform` ومخزن `media` |

---

## 1) مفتاح Supabase السري

1. افتح `supabase.com/dashboard` → مشروع **edu-platform**.
2. **Project Settings → API Keys** → انسخ مفتاح **service_role** (أو **Secret key**).
3. ⚠️ المفتاح ده سري — حطه في Back4App بس (خطوة 2)، ماتبعتهوش لحد ولا تحطه في الكود.

رابط المشروع (مش سري): `https://thmyjolndsjwaedpdoht.supabase.co` — موجود بالفعل في `render.yaml`.

---

## 2) السيرفر — Back4App Containers

1. `back4app.com` → **Sign up** (بالإيميل أو GitHub — من غير بطاقة).
2. من اللوحة: **Containers / Web Deployment → New App** → **Connect GitHub** واسمحله يشوف الريبو `edu-platform`.
3. إعدادات الـ App:
   - **Branch**: `main`
   - **Root directory**: `backend` (فيه الـ Dockerfile)
   - **Port**: `8000` (لو سألك — الـ Dockerfile معلن عنه بـ `EXPOSE`)
   - **Auto deploy**: شغّال (كل push على GitHub يتنشر لوحده)
4. **Environment Variables** — خد القيم السرية من ملف `.env` اللي على جهازك:

   | المتغير | القيمة |
   |---|---|
   | `DATABASE_URL` | نفس اللي في `.env` |
   | `QDRANT_URL` / `QDRANT_API_KEY` | نفس اللي في `.env` |
   | `OPENAI_API_KEY` | نفس اللي في `.env` (لازم يكون فيه رصيد عشان خصائص الذكاء الاصطناعي) |
   | `SECRET_KEY` | نص عشوائي طويل — ولّده بالأمر: `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `SUPABASE_URL` | `https://thmyjolndsjwaedpdoht.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | المفتاح من خطوة 1 |
   | `STORAGE_BUCKET` | `media` |
   | `MAX_VIDEO_UPLOAD_MB` | `50` |
   | `UPLOAD_DIR` | `/app/uploads` |
   | `ENVIRONMENT` | `production` |
   | `AI_MODEL` / `EMBEDDING_MODEL` | `gpt-4o` / `text-embedding-3-large` |
   | `CORS_ORIGINS` | رابط الواجهة من خطوة 3 (حط أي قيمة مؤقتاً وعدّلها بعدين) |

5. **Deploy** واستنى أول build (كام دقيقة). هتاخد رابط شكله `https://edu-platform-xxxx.b4a.run`.
6. اختبر: افتح `https://<رابط-السيرفر>/health` — لازم يرجع `{"status":"ok"}`.

> **Qdrant:** الكلستر المجاني بيتوقف لو ما اتستخدمش فترة. افتح `cloud.qdrant.io` واتأكد إن الكلستر **Running** (لو متوقف اضغط Resume) — من غير كده شرح الدروس والأسئلة من المنهج مش هيشتغل.
>
> **Render (لو عندك بطاقة بعدين):** `render.yaml` لسه جاهز — New → Blueprint، وبيدّي 512MB رام بدل 256MB.

---

## 3) الواجهة — Vercel

1. `vercel.com` → المشروع **edu-platform** الموجود → **Settings**:
   - **General → Root Directory** = `frontend`
   - **Environment Variables** → `NEXT_PUBLIC_API_URL` = رابط السيرفر من خطوة 2 (من غير `/` في الآخر)
2. **Deployments → Redeploy** (لازم إعادة build عشان المتغير يدخل).
3. انسخ رابط الواجهة (`https://....vercel.app`) وارجع لـ Back4App → Environment Variables → حدّث `CORS_ORIGINS` بيه بالظبط → Save وأعد النشر (Redeploy).

لو المشروع مش مربوط بالريبو: **Add New → Project** → اختار `edu-platform` من GitHub → Root Directory = `frontend` → نفس المتغير.

---

## 4) اختبار

1. افتح رابط Vercel → سجّل دخول / اعمل حساب مدرس.
2. ارفع منهج صغير، اعمل نشاط، وجرب رابط المشاركة من موبايل.
3. ارفع فيديو صغير (أقل من 50MB) — لازم يفضل شغال حتى بعد ما السيرفر ينام ويصحى (الملف في Supabase).

---

## حدود الخطة المجانية (مهم تعرفها)

- **600 ساعة في الشهر** (الشهر 720 ساعة) — لو السيرفر فضل شغال 24 ساعة، الساعات هتخلص قبل آخر الشهر بكام يوم ويتوقف لحد أول الشهر الجاي. للتجربة ده كفاية؛ ماتستخدمش خدمات "تصحية" السيرفر.
- **256MB رام وربع معالج** — كفاية لتجربة بعدد قليل من المستخدمين؛ معالجة منهج كبير بتاخد وقت أطول.
- **الملفات 1GB بس** وأقصى ملف 50MB (السيرفر بيرفض أي فيديو أكبر من كده تلقائياً).
- **Vercel Hobby للاستخدام غير التجاري** — لو هتفعّل الاشتراكات المدفوعة، انقل الواجهة لـ Netlify أو سيرفر مدفوع.
- **Supabase** بيوقف المشروع لو فضل أسبوع من غير أي استخدام — تفتحه من اللوحة بضغطة (Restore).
- **ملفات المناهج الأصلية (PDF)** مش بتتحفظ — بتتعالج وتتخزن في قاعدة البيانات و Qdrant، وده كفاية لشغل البرنامج.
