from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import init_db
from app.routers import auth, curriculum, ai, admin, teacher, notifications, export, question_bank, payments, coupons, schedule, assignments, videos, activities, live


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-powered educational platform with RAG pipeline",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(curriculum.router)
app.include_router(ai.router)
app.include_router(admin.router)
app.include_router(teacher.router)
app.include_router(notifications.router)
app.include_router(export.router)
app.include_router(question_bank.router)
app.include_router(payments.router)
app.include_router(coupons.router)
app.include_router(schedule.router)
app.include_router(assignments.router)
app.include_router(videos.router)
app.include_router(activities.router)
app.include_router(activities.study_router)
app.include_router(live.router)

# Serve uploaded files (in production, use nginx/CDN instead)
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME}
