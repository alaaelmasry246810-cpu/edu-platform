"""Notification endpoints — list, mark read, count unread."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the last 30 notifications for the current user."""
    r = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
    )
    notifs = r.scalars().all()
    return [{
        "id": str(n.id),
        "title": n.title,
        "body": n.body,
        "type": n.notif_type,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    } for n in notifs]


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    count = r.scalar() or 0
    return {"count": count}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "تم تحديد الكل كمقروء"}


@router.post("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "تم"}
