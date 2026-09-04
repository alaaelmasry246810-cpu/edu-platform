"""Admin CRUD for discount coupons."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.coupon import Coupon
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/admin/coupons", tags=["Coupons"])


def _require_admin(user: User):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admins only")


# ── List ──────────────────────────────────────────────────────

@router.get("")
async def list_coupons(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    r = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    return [_ser(c) for c in r.scalars().all()]


# ── Create ────────────────────────────────────────────────────

class CouponCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_percent: float           # 1-100
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None


@router.post("")
async def create_coupon(
    body: CouponCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    if not (1 <= body.discount_percent <= 100):
        raise HTTPException(status_code=400, detail="نسبة الخصم يجب أن تكون بين 1 و 100")
    code = body.code.upper().strip()
    # Check uniqueness
    ex = await db.execute(select(Coupon).where(Coupon.code == code))
    if ex.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="كود الكوبون موجود مسبقاً")
    coupon = Coupon(
        code=code,
        description=body.description,
        discount_percent=body.discount_percent,
        max_uses=body.max_uses,
        expires_at=body.expires_at,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return _ser(coupon)


# ── Toggle active ─────────────────────────────────────────────

@router.patch("/{coupon_id}/toggle")
async def toggle_coupon(
    coupon_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    r = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = r.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="كوبون غير موجود")
    coupon.is_active = not coupon.is_active
    await db.commit()
    return _ser(coupon)


# ── Delete ────────────────────────────────────────────────────

@router.delete("/{coupon_id}")
async def delete_coupon(
    coupon_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    r = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = r.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="كوبون غير موجود")
    await db.delete(coupon)
    await db.commit()
    return {"message": "تم الحذف"}


# ── Validate (public — used by frontend before checkout) ──────

@router.get("/validate/{code}")
async def validate_coupon(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return coupon details if valid; 404 otherwise."""
    r = await db.execute(select(Coupon).where(Coupon.code == code.upper(), Coupon.is_active == True))
    coupon = r.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="كوبون غير صالح")
    if coupon.expires_at and coupon.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="انتهت صلاحية الكوبون")
    if coupon.max_uses is not None and coupon.times_used >= coupon.max_uses:
        raise HTTPException(status_code=400, detail="استُنفد الكوبون")
    return {"discount_percent": coupon.discount_percent, "description": coupon.description}


# ── Helpers ───────────────────────────────────────────────────

def _ser(c: Coupon) -> dict:
    return {
        "id": str(c.id),
        "code": c.code,
        "description": c.description,
        "discount_percent": c.discount_percent,
        "max_uses": c.max_uses,
        "times_used": c.times_used,
        "is_active": c.is_active,
        "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        "created_at": c.created_at.isoformat(),
    }
