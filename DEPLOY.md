# دليل الرفع — خطة مجانية للتجربة على Vercel (بدون بطاقة ائتمان)

> **للتجربة بس.** مجانية بالكامل وليها حدود (تحت). لما يبقى فيه طلاب حقيقيين أو اشتراكات مدفوعة، الأنسب سيرفر VPS صغير (~4–6$ في الشهر).
>
> **ليه Vercel للسيرفر كمان؟** Hugging Face بقى مدفوع لأي Docker، وRender بيطلب بطاقة، وBack4App المجاني رابطه بيعيش 60 دقيقة بس. Vercel بيشغّل FastAPI مجاناً (2GB رام، 5 دقايق لكل طلب) — بس محتاج 3 تعديلات اتعملت في الكود:
> 1. **الملفات الكبيرة بتترفع من المتصفح مباشرة لـ Supabase** (Vercel بيرفض أي طلب أكبر من 4.5MB) — `routers/uploads.py` + `withDirectUpload` في الواجهة.
> 2. **المعالجة بتتعمل جوه الطلب** (`INLINE_TASKS=true`) لأن Vercel مش بيضمن يكمّل الشغل بعد الرد.
> 3. **`backend/vercel.json`**: السيرفر في منطقة Cleveland (`cle1`) جنب قاعدة بيانات Neon، وأقصى مدة للطلب 300 ثانية.

| الطبقة | الخدمة | ملاحظات |
|---|---|---|
| الواجهة (Next.js) | **Vercel** — مشروع من فولدر `frontend` | للاستخدام غير التجاري |
| السيرفر (FastAPI) | **Vercel** — مشروع من فولدر `backend` | 2GB رام، 300 ثانية/طلب، مفيش نوم |
| قاعدة البيانات | **Neon** (`us-east-2`) | موجودة |
| البحث في المناهج | **Qdrant Cloud** | اتأكد إن الكلستر Running |
| الملفات | **Supabase** — مشروع `edu-platform` | مخزن `media` (عام: فيديوهات/صوت) + `incoming` (خاص: ملفات المناهج قبل المعالجة) — 1GB، أقصى ملف 50MB |

---

## 1) السيرفر على Vercel

1. `vercel.com` → **Add New → Project** → اختار الريبو `edu-platform`.
2. **Project Name**: `edu-platform-api` — **Root Directory**: `backend` — Framework: **FastAPI** (بيتعرف لوحده).
3. **Environment Variables** → افتح ملف **`vercel-backend.env`** اللي في فولدر المشروع على جهازك (مش بيترفع على GitHub)، انسخ كل محتواه، والصقه في أول خانة (Vercel بيقسمه لوحده لمتغيرات).
   - قبل اللصق: بدّل `PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE` بمفتاح **service_role** من Supabase → مشروع edu-platform → Project Settings → API Keys → تاب **Legacy anon, service_role API keys** → Reveal → Copy.
   - `CORS_ORIGINS` سيبه دلوقتي — هيتعدل في خطوة 3.
4. **Deploy**. الرابط هيبقى شكله `https://edu-platform-api.vercel.app` — افتح `/health` لازم يرجع `{"status":"ok"}`.

## 2) الواجهة على Vercel

1. المشروع `edu-platform` الموجود (أو Add New → Project بنفس الريبو) → **Root Directory**: `frontend`.
2. **Environment Variables** → `NEXT_PUBLIC_API_URL` = رابط السيرفر من خطوة 1 (من غير `/` في الآخر).
3. **Deploy / Redeploy**.

## 3) ربط الاتنين

مشروع السيرفر → Settings → Environment Variables → `CORS_ORIGINS` = رابط الواجهة بالظبط (مثلاً `https://edu-platform.vercel.app`) → Save → Deployments → **Redeploy**.

---

## حدود الخطة المجانية

- **رفع منهج كبير**: المعالجة لازم تخلص في 5 دقايق (الصفحة بتستنى لحد ما تخلص). منهج مصوّر كبير جداً ممكن يعدّيها — جرّب بمناهج صغيرة ومتوسطة.
- **الملفات**: 1GB إجمالي، وأقصى ملف 50MB.
- **المسابقة الحية**: كل لاعب بيسأل السيرفر كل ثانية — الخطة المجانية فيها ~مليون طلب في الشهر، يعني ساعات قليلة من مسابقات بفصل كامل. كفاية للتجربة.
- **Vercel Hobby للاستخدام غير التجاري**.
- **Supabase** بيوقف المشروع لو فضل أسبوع من غير استخدام — تفتحه من اللوحة (Restore).
- **Qdrant Cloud** المجاني بيتوقف لو ما اتستخدمش فترة — Resume من `cloud.qdrant.io`.

## بدائل لو احتجت

- **Render** (لو بقى معاك بطاقة): `render.yaml` جاهز — 512MB رام، بينام بعد 15 دقيقة.
- **التشغيل من جهازك**: `start.bat` + Cloudflare Tunnel (رابط مؤقت مجاني).
