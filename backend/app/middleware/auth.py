from datetime import datetime, timedelta
from typing import Optional
import uuid
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, AccountStatus

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": expire, "type": "access"},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise credentials_exc
    if user.status != AccountStatus.ACTIVE:
        raise HTTPException(status_code=403, detail=f"Account is {user.status.value}")
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def check_quota(user: User, action: str) -> None:
    """Enforce free-tier limits."""
    from app.models.user import SubscriptionPlan
    if user.plan != SubscriptionPlan.FREE:
        return  # Paid users have no limits

    from app.config import settings
    if action == "upload" and user.pages_uploaded_this_month >= settings.FREE_PAGES_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Free plan limit: {settings.FREE_PAGES_LIMIT} pages/month. Upgrade to continue."
        )
    if action == "questions" and user.questions_generated_today >= settings.FREE_QUESTIONS_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail=f"Free plan limit: {settings.FREE_QUESTIONS_PER_DAY} questions/day. Upgrade to continue."
        )
    if action == "summary" and user.summaries_generated_this_month >= settings.FREE_SUMMARIES_PER_MONTH:
        raise HTTPException(
            status_code=429,
            detail=f"Free plan limit: {settings.FREE_SUMMARIES_PER_MONTH} summaries/month. Upgrade to continue."
        )
