"""Helper to create notifications for users."""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str | None = None,
    notif_type: str = "info",
    link: str | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        notif_type=notif_type,
        link=link,
    )
    db.add(notif)
    # Do NOT commit here — caller commits after other changes
    return notif
