"""Direct browser → storage uploads.

Some hosts (Vercel) reject request bodies over 4.5MB, so big files — a
curriculum PDF, a lesson video, a podcast — are PUT by the browser straight
into Supabase Storage with a one-time signed URL; the create endpoint then
receives just the storage key. When storage isn't remote (local / own server)
this reports enabled=false and the client uploads the file normally."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import get_uploader
from app.models.user import User
from app.services import storage

router = APIRouter(prefix="/storage", tags=["Uploads"])

_PURPOSES = {
    # purpose: (bucket, key prefix, allowed extensions)
    "curriculum": ("INCOMING_BUCKET", "curricula", {".pdf", ".png", ".jpg", ".jpeg", ".webp"}),
    "video": ("STORAGE_BUCKET", "videos", {".mp4", ".webm", ".mov", ".m4v", ".ogv"}),
    "podcast": ("STORAGE_BUCKET", "videos", {".mp3", ".m4a", ".wav", ".webm", ".ogg", ".mp4", ".mpeg", ".mpga"}),
}


class UploadUrlBody(BaseModel):
    filename: str
    purpose: str
    size: int | None = None


@router.post("/upload-url")
async def upload_url(body: UploadUrlBody, user: User = Depends(get_uploader)):
    if not storage.remote():
        return {"enabled": False}
    if body.purpose not in _PURPOSES:
        raise HTTPException(status_code=400, detail="Unknown upload purpose")
    bucket_setting, prefix, allowed = _PURPOSES[body.purpose]
    ext = Path(body.filename).suffix.lower() or (".webm" if body.purpose == "podcast" else "")
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    if body.size and body.size > settings.MAX_VIDEO_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"الملف أكبر من {settings.MAX_VIDEO_UPLOAD_MB}MB")
    # The key is scoped to the user, so create endpoints can check it's theirs.
    key = f"{prefix}/{user.id}/{uuid.uuid4().hex}/media{ext}" if prefix == "videos" else f"{prefix}/{user.id}/{uuid.uuid4().hex}{ext}"
    try:
        url = await storage.create_signed_upload(getattr(settings, bucket_setting), key)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"enabled": True, "key": key, "url": url}


def owned_key(key: str, prefix: str, user_id) -> str:
    """Validate a storage key from a create request belongs to this user."""
    if not key.startswith(f"{prefix}/{user_id}/") or ".." in key:
        raise HTTPException(status_code=400, detail="Invalid upload key")
    return key
