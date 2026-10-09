from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all never alters existing tables — add columns introduced later.
        await conn.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_text TEXT"))
        await conn.execute(text("ALTER TABLE interactive_videos ADD COLUMN IF NOT EXISTS script_mode VARCHAR(20)"))
        await conn.execute(text("ALTER TABLE interactive_videos ADD COLUMN IF NOT EXISTS source_text TEXT"))
        await conn.execute(text("ALTER TABLE interactive_videos ADD COLUMN IF NOT EXISTS display_mode VARCHAR(10)"))
        await conn.execute(text("ALTER TABLE interactive_videos ADD COLUMN IF NOT EXISTS text_track JSON"))
        await conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS calm_mode BOOLEAN DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS game_minutes INTEGER"))
        await conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS link_enabled BOOLEAN DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS share_token VARCHAR(32)"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_activities_share_token ON activities (share_token)"))
        await conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN DEFAULT TRUE"))
        await conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS leaderboard_visible BOOLEAN DEFAULT TRUE"))
        await conn.execute(text("ALTER TABLE activity_attempts ALTER COLUMN user_id DROP NOT NULL"))
        await conn.execute(text("ALTER TABLE activity_attempts ADD COLUMN IF NOT EXISTS guest_name VARCHAR(40)"))
        await conn.execute(text("ALTER TABLE activity_attempts ADD COLUMN IF NOT EXISTS guest_key VARCHAR(64)"))
        # Lessons that cached the "no content found" fallback before it was
        # excluded from caching get regenerated on next view.
        from app.services.rag_service import NO_CONTENT_MESSAGE
        await conn.execute(text("UPDATE lessons SET explanation = NULL WHERE explanation = :m"), {"m": NO_CONTENT_MESSAGE})
        await conn.execute(text("UPDATE lessons SET summary = NULL, has_summary = FALSE WHERE summary = :m"), {"m": NO_CONTENT_MESSAGE})
