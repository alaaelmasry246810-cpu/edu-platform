# دليل الرفع (Free Tier — بدون بطاقة ائتمان)

الأربع خدمات دي اتأكد إنها بتشتغل مجاني **من غير ما تطلب بطاقة ائتمان أبدًا** (مش مجرد "مجاني بس محتاج بطاقة للتحقق"):

| الطبقة | الخدمة | ليه |
|---|---|---|
| Backend (FastAPI + Docker) | **Hugging Face Spaces** | Docker SDK مجاني بالكامل، بدون بطاقة إطلاقًا. 2 vCPU / 16GB RAM (أعلى بكتير من Render). يدعم `apt-get install` عادي (محتاجينه لـ tesseract-ocr) |
| Frontend (Next.js) | **Vercel** | Hobby plan مجاني بدون بطاقة. لو طلب بطاقة في حسابك (بيحصل أحيانًا لبعض الحسابات/الدول)، البديل: **Cloudflare Pages** (لا يطلب بطاقة إطلاقًا) |
| Database (Postgres) | **Neon** | Free tier بدون بطاقة، 0.5GB. البديل: **Supabase** |
| Vector DB (Qdrant) | **Qdrant Cloud** | Free cluster بدون بطاقة، 1GB RAM |

> ملحوظة: Render سبق وطلب بطاقة "للتحقق من الهوية" حتى على الخطة المجانية — ده بيحصل مع بعض الحسابات/الدول. الخطة دي بتستبدل Render بـ Hugging Face Spaces عشان نتجنب المشكلة دي تمامًا.

---

## 1) قاعدة البيانات — Neon (Postgres)

1. `neon.tech` → Sign up (بالإيميل أو GitHub، من غير بطاقة).
2. أنشئ Project جديد، وهياديك connection string شكله:
   `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`
3. غيّر البادئة لتتوافق مع الـ async driver المستخدم في المشروع:
   `postgresql+asyncpg://user:pass@ep-xxx.neon.tech/dbname?ssl=require`
   (احتفظ بيها — هتحتاجها كـ `DATABASE_URL`)

لو Neon رفض حسابك لأي سبب، البديل المباشر: `supabase.com` (نفس الفكرة، هتلاقي الـ connection string في Project Settings → Database).

---

## 2) الـ Vector Store — Qdrant Cloud

1. `cloud.qdrant.io` → Sign up.
2. أنشئ Free Cluster (1GB).
3. من الـ Cluster هتاخد `QDRANT_URL` (شكله `https://xxx.cloud.qdrant.io`) و `QDRANT_API_KEY`.

---

## 3) الـ Backend — Hugging Face Spaces

1. `huggingface.co` → Sign up (بدون بطاقة).
2. **New Space** → اختار اسم، واختار SDK = **Docker**، Visibility حسب رغبتك.
3. هتاخد رابط Space الخاص بيك كـ git remote:
   `https://huggingface.co/spaces/<username>/<space-name>`
4. من مجلد المشروع (`edu-platform`)، ارفع مجلد `backend/` بس كـ subtree لـ الـ Space (بيحافظ على تاريخ commits المشروع الأساسي ومايبعتش الـ frontend):
   ```bash
   git remote add hf-backend https://huggingface.co/spaces/<username>/<space-name>
   git subtree push --prefix=backend hf-backend main
   ```
   (لو الـ Space بيستخدم فرع `master` بدل `main`، استبدلها فوق)
5. هيبدأ الـ build تلقائيًا (تقدر تتابعه من تبويب "Logs" في الـ Space). أول build بياخد كذا دقيقة بسبب تثبيت tesseract/opencv.
6. من **Settings → Variables and secrets** في الـ Space ضيف:
   - `DATABASE_URL` (من Neon)
   - `QDRANT_URL`, `QDRANT_API_KEY` (من Qdrant Cloud)
   - `SECRET_KEY` (أي نص عشوائي 64 حرف — تقدر تولّده بـ `openssl rand -hex 32`)
   - `OPENAI_API_KEY`
   - `AI_MODEL=gpt-4o`, `EMBEDDING_MODEL=text-embedding-3-large`
   - `ENVIRONMENT=production`
   - `CORS_ORIGINS` — هتحطه بعد ما تجيب رابط الـ frontend من فيرسيل (خطوة 4)
7. رابط الـ backend النهائي هيكون:
   `https://<username>-<space-name>.hf.space`

> ملحوظة: الـ Space المجاني بينام بعد فترة عدم استخدام (زي Render تمامًا) ويصحى تلقائي أول ما يوصله طلب — أول طلب بعد النوم هياخد شوية ثواني زيادة.
> ملحوظة تانية: التخزين على الـ Space المجاني مش دائم (بيتصفر لو الـ Space اتعاد تشغيله) — الملفات المرفوعة بتتعالج وتتخزن في Postgres/Qdrant، فده مش هيأثر على البيانات، بس لو حابب تحتفظ بنسخة الملف الأصلي (PDF الأصلي) لازم تضيف تخزين خارجي (زي Cloudflare R2 المجاني) — قولّي لو عايزني أضيف ده.

---

## 4) الـ Frontend — Vercel

1. `vercel.com` → Sign up بحساب GitHub (بدون بطاقة).
2. **Add New → Project** → اختار الريبو `edu-platform`.
3. في إعدادات الـ Import: **Root Directory** = `frontend`.
4. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = رابط الـ backend من خطوة 3 (من غير `/api` في الآخر — الكود بيكلم الـ backend مباشرة)
     مثال: `https://<username>-<space-name>.hf.space`
5. Deploy. هتاخد رابط شكله `https://your-app.vercel.app`.
6. ارجع لإعدادات الـ Hugging Face Space وحدّث `CORS_ORIGINS` بالرابط ده بالظبط، وأعد تشغيل الـ Space (Restart) عشان يقرأ المتغير الجديد.

لو فيرسيل طلب بطاقة في حسابك، البديل: **Cloudflare Pages** (`pages.cloudflare.com` أو من dash.cloudflare.com → Workers & Pages) — بيدعم Next.js عن طريق الـ build preset بتاعه تلقائيًا، ونفس فكرة الـ env variable `NEXT_PUBLIC_API_URL`.

---

## 5) اختبار سريع

```bash
curl https://<username>-<space-name>.hf.space/health
```

لو رجع `200 OK`، افتح رابط فيرسيل وجرب تسجيل حساب جديد.

---

## نسخة احتياطية بديلة

`render.yaml` الموجود في جذر المشروع لسه شغال لو حبيت تجرب Render تاني بحساب تاني أو IP مختلف — بس الخطة دي (Hugging Face) مش محتاجاله.
