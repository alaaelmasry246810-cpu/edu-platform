# 🎓 منصة التعليم الذكي — Smart Edu Platform

منصة تعليمية مدعومة بالذكاء الاصطناعي تحوّل مناهجك المُرفوعة (PDF، صور، QR) إلى دروس تفاعلية، ملخصات، بنك أسئلة، وامتحانات مُخصصة — بدون أي هلوسة ذكاء اصطناعي (RAG صفر هلوسة).

---

## 🏗️ هيكل المشروع

```
edu-platform/
├── backend/              # FastAPI — Python 3.12
│   ├── app/
│   │   ├── models/       # SQLAlchemy models (User, Curriculum, Unit, Lesson, Question)
│   │   ├── routers/      # auth, curriculum, ai, admin
│   │   ├── services/     # ocr_service, rag_service
│   │   ├── middleware/   # JWT auth, quota enforcement
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── config.py     # Settings (BaseSettings)
│   │   ├── database.py   # Async SQLAlchemy engine
│   │   └── main.py       # FastAPI app entry
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # Next.js 14 — TypeScript
│   ├── app/
│   │   ├── auth/         # Login / Register
│   │   ├── dashboard/    # Student: curricula, lessons, exam, glossary
│   │   └── admin/        # Admin: stats, users, plans, AI settings
│   ├── components/layout/Sidebar.tsx
│   ├── lib/              # api.ts, store.ts (Zustand)
│   ├── Dockerfile
│   └── tailwind.config.js
├── nginx/nginx.conf      # Reverse proxy
├── docker-compose.yml    # Full stack orchestration
└── .env.example          # Environment variables template
```

---

## ⚡ متطلبات التشغيل

- Docker Engine ≥ 24 + Docker Compose v2
- ذاكرة RAM: 4 GB كحد أدنى (8 GB مُوصى به)
- مساحة قرص: 20 GB
- مفتاح OpenAI API (للـ Embeddings والتوليد)

---

## 🚀 تشغيل المشروع (خطوة واحدة)

### 1. انسخ المشروع وادخل إليه

```bash
git clone <repo-url> edu-platform
cd edu-platform
```

### 2. أنشئ ملف البيئة

```bash
cp .env.example .env
```

ثم عدّل `.env` بقيمك الفعلية:

```env
# قاعدة البيانات (لا تُغيّر الـ host داخل Docker)
POSTGRES_DB=edudb
POSTGRES_USER=eduuser
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# مفاتيح الأمان
SECRET_KEY=CHANGE_ME_64_CHAR_RANDOM_STRING

# OpenAI
OPENAI_API_KEY=sk-...

# النموذج الافتراضي
AI_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-large

# بوابات الدفع (اختيارية في البداية)
STRIPE_SECRET_KEY=sk_live_...
PAYMOB_API_KEY=...

# عنوان الـ API للـ Frontend
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
CORS_ORIGINS=http://YOUR_SERVER_IP,https://yourdomain.com
```

### 3. شغّل كل شيء

```bash
docker compose up -d --build
```

سيبدأ Docker في بناء الـ images ثم تشغيل 6 خدمات:
- **postgres** — قاعدة بيانات PostgreSQL 16
- **qdrant** — قاعدة البيانات المتجهة للـ RAG
- **redis** — Cache والـ Rate Limiting
- **backend** — FastAPI على المنفذ 8000
- **frontend** — Next.js على المنفذ 3000
- **nginx** — Reverse Proxy على المنفذ 80

### 4. انتظر حتى تكتمل الـ migrations

```bash
docker compose logs -f backend
# انتظر حتى ترى: "Application startup complete."
```

### 5. أنشئ أول مستخدم Admin

```bash
docker compose exec backend python -c "
import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole, AccountStatus, SubscriptionPlan
from app.middleware.auth import hash_password
import uuid

async def create_admin():
    async with AsyncSessionLocal() as db:
        admin = User(
            id=str(uuid.uuid4()),
            email='admin@example.com',
            full_name='Super Admin',
            hashed_password=hash_password('AdminPass123!'),
            role=UserRole.ADMIN,
            status=AccountStatus.ACTIVE,
            subscription_plan=SubscriptionPlan.YEARLY,
        )
        db.add(admin)
        await db.commit()
        print('Admin created: admin@example.com / AdminPass123!')

asyncio.run(create_admin())
"
```

### 6. افتح المنصة

- **الواجهة الرئيسية:** `http://YOUR_SERVER_IP`
- **API Docs:** `http://YOUR_SERVER_IP/api/docs`

---

## 📱 صفحات المنصة

| المسار | الوصف |
|--------|-------|
| `/auth/login` | تسجيل الدخول / إنشاء حساب |
| `/dashboard` | قائمة المناهج المُرفوعة |
| `/dashboard/upload` | رفع منهج جديد (PDF/صورة) |
| `/dashboard/lessons/[id]` | دروس المنهج + شرح + ملخص + مصطلحات + أسئلة |
| `/dashboard/exam` | امتحان مُخصص |
| `/dashboard/summary` | معجم المصطلحات |
| `/admin` | لوحة الإدارة — إحصائيات |
| `/admin/users` | إدارة المستخدمين (موافقة/رفض/خطة) |
| `/admin/plans` | تعديل الأسعار والحدود |
| `/admin/ai-settings` | تغيير نموذج الذكاء الاصطناعي وإعدادات RAG |

---

## 🔌 API Endpoints

### Auth
```
POST /auth/register      — تسجيل مستخدم جديد (يبقى pending حتى موافقة الآدمن)
POST /auth/login         — تسجيل الدخول، يُعيد access_token + refresh_token
GET  /auth/me            — بيانات المستخدم الحالي
```

### Curricula
```
POST /curricula/upload              — رفع ملف PDF/صورة مع البيانات الوصفية
GET  /curricula/                    — قائمة مناهج المستخدم
GET  /curricula/{id}/structure      — شجرة الوحدات والدروس
```

### AI
```
GET  /ai/lesson/{id}/explanation    — شرح الدرس (مُخزن مؤقتاً)
GET  /ai/lesson/{id}/summary        — ملخص الدرس
GET  /ai/lesson/{id}/key-terms      — مصطلحات الدرس
POST /ai/curriculum/{id}/questions  — توليد أسئلة
GET  /ai/curriculum/{id}/all-terms  — كل مصطلحات المنهج
POST /ai/exam/create                — إنشاء امتحان مُخصص
POST /ai/exam/submit                — تسليم الامتحان وتسجيل النتيجة
```

### Admin
```
GET   /admin/stats              — إحصائيات المنصة
GET   /admin/users              — قائمة المستخدمين (مع فلترة)
PATCH /admin/users/{id}         — تحديث حالة/خطة مستخدم
GET   /admin/settings           — الإعدادات الديناميكية
PATCH /admin/settings           — تحديث النموذج/الحصص/الأسعار
```

---

## 🛠️ أوامر مفيدة

```bash
# مراقبة جميع الخدمات
docker compose logs -f

# مراقبة خدمة واحدة
docker compose logs -f backend

# إيقاف تشغيل المنصة
docker compose down

# إعادة البناء بعد تعديل الكود
docker compose up -d --build backend   # backend فقط
docker compose up -d --build frontend  # frontend فقط

# نسخة احتياطية لقاعدة البيانات
docker compose exec postgres pg_dump -U eduuser edudb > backup_$(date +%Y%m%d).sql

# استعادة نسخة احتياطية
docker compose exec -T postgres psql -U eduuser edudb < backup_20240101.sql

# عرض استخدام الموارد
docker stats
```

---

## 🔐 الأمان والإنتاج

### HTTPS (مُوصى به بشدة للإنتاج)

1. أضف شهادة SSL لـ Nginx (Let's Encrypt + Certbot):
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

2. حدّث `nginx/nginx.conf` لإعادة التوجيه من HTTP لـ HTTPS.

### متغيرات البيئة الضرورية للإنتاج

```env
SECRET_KEY=<64+ حرف عشوائي>
POSTGRES_PASSWORD=<كلمة مرور قوية>
CORS_ORIGINS=https://yourdomain.com   # فقط دومينك، بدون wildcard
```

---

## 🧩 التوسع المستقبلي

- **Flutter App**: موجود في المواصفات، يستخدم نفس الـ API endpoints
- **Celery + Redis**: لمعالجة الملفات الكبيرة بشكل غير متزامن
- **Stripe/PayMob**: integration جاهزة في الـ backend، تحتاج activation
- **Multi-tenancy**: إضافة `school_id` للـ models لدعم المدارس

---

## 📊 حدود الخطة المجانية (قابلة للتعديل من لوحة الآدمن)

| الميزة | مجاني | مدفوع |
|--------|-------|-------|
| صفحات / شهر | 15 | غير محدود |
| أسئلة / يوم | 20 | غير محدود |
| ملخصات / شهر | 10 | غير محدود |
| امتحانات مُخصصة | ✅ | ✅ |

---

## 🤝 المساهمة والدعم

- **تقارير الأخطاء**: افتح Issue في المستودع
- **التخصيص**: كل الإعدادات قابلة للتغيير من `.env` أو لوحة الآدمن بدون إعادة نشر
