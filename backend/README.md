---
title: Edu Platform Backend
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
---

# Edu Platform — Backend (FastAPI)

Deployed as a Hugging Face Docker Space. See `/DEPLOY.md` at the repo root for
the full free-tier deployment guide.

Required Space secrets (Settings → Variables and secrets):

- `DATABASE_URL` — Neon/Supabase Postgres connection string (`postgresql+asyncpg://...`)
- `QDRANT_URL`, `QDRANT_API_KEY` — Qdrant Cloud cluster
- `SECRET_KEY` — random 64-char string
- `OPENAI_API_KEY`
- `CORS_ORIGINS` — your frontend URL (e.g. `https://your-app.vercel.app`)
