from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Educational Platform"
    ENVIRONMENT: Literal["development", "production"] = "production"
    CORS_ORIGINS: str = "http://localhost:3000"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://eduuser:password@localhost:5432/eduplatform"

    # Qdrant — set QDRANT_URL for a managed cluster (e.g. Qdrant Cloud), else
    # falls back to QDRANT_HOST/QDRANT_PORT for a local/self-hosted instance.
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "curricula"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # AI — provider: "openai" or "gemini" (free tier; see services/ai_client.py)
    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"
    GEMINI_FAST_MODEL: str = "gemini-flash-lite-latest"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_REASONING_EFFORT: str = "low"
    # Narration of AI videos (Arabic, several voices). The free tier allows ~10
    # requests/day PER MODEL, so these are used in turn as each one runs out.
    GEMINI_TTS_MODELS: str = "gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts"
    GROQ_API_KEY: str = ""  # free Whisper speech-to-text (podcasts / uploaded videos)
    AI_MODEL: str = "gpt-4o"
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIMENSION: int = 3072  # text-embedding-3-large

    # RAG
    RAG_MAX_GENERATION_CHUNKS: int = 40   # chunk budget when a generation task pulls a full curriculum/unit/lesson scope
    RAG_CHUNK_SIZE: int = 800    # tokens per chunk
    RAG_CHUNK_OVERLAP: int = 100

    # Subscriptions
    FREE_PAGES_LIMIT: int = 15
    FREE_QUESTIONS_PER_DAY: int = 20
    FREE_SUMMARIES_PER_MONTH: int = 10

    # Payments
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_MONTHLY: str = ""   # price_xxx from Stripe dashboard
    STRIPE_PRICE_YEARLY: str = ""    # price_xxx from Stripe dashboard
    PAYMOB_API_KEY: str = ""

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_VIDEO_UPLOAD_MB: int = 500  # teacher lesson videos / podcasts (interactive videos); 50 on Supabase's free plan

    # Media storage (interactive videos, podcasts, narration). Set both on a host
    # whose disk isn't persistent (e.g. Render free) — files then go to this
    # public Supabase Storage bucket instead of UPLOAD_DIR.
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    STORAGE_BUCKET: str = "media"
    # Private bucket for files the browser uploads directly (curriculum PDFs/images)
    # before the server processes them.
    INCOMING_BUCKET: str = "incoming"

    # Run "background" jobs (curriculum processing, video generation) inside the
    # request instead — for serverless hosts like Vercel that may stop work once
    # the response is sent. Requests then take as long as the job (max 300s there).
    INLINE_TASKS: bool = False
    UPLOAD_DIR: str = "/app/uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        # Docker containers get real env vars from docker-compose (no .env file
        # inside the image); a native run (uvicorn launched with cwd=backend/)
        # instead needs the repo-root .env, one directory up.
        env_file = ("../.env", ".env")
        # The root .env also holds vars meant for other services (postgres,
        # the frontend build) that aren't Settings fields — ignore rather than
        # reject them.
        extra = "ignore"


settings = Settings()
