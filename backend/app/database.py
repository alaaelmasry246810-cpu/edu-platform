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
