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

    # AI
    OPENAI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o"
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIMENSION: int = 3072  # text-embedding-3-large

    # RAG
    RAG_TOP_K: int = 8           # chunks retrieved per query
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
    UPLOAD_DIR: str = "/app/uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
