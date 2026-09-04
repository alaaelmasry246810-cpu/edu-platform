"""Discount coupons for subscription plans."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g. "SAVE20"
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    discount_percent: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)    # None = unlimited
    times_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
