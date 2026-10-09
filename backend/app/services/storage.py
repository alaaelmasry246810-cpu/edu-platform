"""File storage for media that must outlive the server process (interactive
video uploads, podcasts, narration audio).

With SUPABASE_URL + SUPABASE_SERVICE_KEY set, files go to a public Supabase
Storage bucket — needed on free hosts whose disk is wiped on every restart or
deploy. Otherwise they're written under UPLOAD_DIR and served at /uploads/
(local development / a server with a persistent disk).

Keys are relative paths like "videos/<owner>/<video>/media.mp4".
"""
import mimetypes
from pathlib import Path

import httpx

from app.config import settings

_TIMEOUT = httpx.Timeout(300.0, connect=20.0)


def remote() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


def _api(path: str) -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/{path}"


def _headers(**extra) -> dict:
    return {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}", "apikey": settings.SUPABASE_SERVICE_KEY, **extra}


def public_url(key: str) -> str:
    if remote():
        return _api(f"object/public/{settings.STORAGE_BUCKET}/{key}")
    return f"/uploads/{key}"


def _key_from_url(url: str) -> str | None:
    if not url:
        return None
    marker = f"/object/public/{settings.STORAGE_BUCKET}/"
    if marker in url:
        return url.split(marker, 1)[1]
    if url.startswith("/uploads/"):
        return url.removeprefix("/uploads/")
    return None


async def save_file(key: str, local_path: Path, content_type: str | None = None) -> str:
    """Store a local file under key; returns its public URL. The local copy is
    left in place (callers may still need it, e.g. for transcription)."""
    if not remote():
        dest = Path(settings.UPLOAD_DIR) / key
        if dest.resolve() != local_path.resolve():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(local_path.read_bytes())
        return public_url(key)
    ctype = content_type or mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
    # Uploads are capped by MAX_VIDEO_UPLOAD_MB (50MB on the free storage plan),
    # so reading the file into memory is fine.
    return await save_bytes(key, local_path.read_bytes(), ctype)


async def save_bytes(key: str, data: bytes, content_type: str) -> str:
    if not remote():
        dest = Path(settings.UPLOAD_DIR) / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return public_url(key)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
        r = await http.post(
            _api(f"object/{settings.STORAGE_BUCKET}/{key}"),
            headers=_headers(**{"Content-Type": content_type, "x-upsert": "true", "cache-control": "31536000"}),
            content=data,
        )
    if r.status_code >= 300:
        raise RuntimeError(f"Storage upload failed ({r.status_code}): {r.text[:200]}")
    return public_url(key)


async def fetch_to(url: str, dest: Path) -> Path:
    """Make sure a stored file is available locally (e.g. to re-transcribe a
    video after the server's disk was wiped)."""
    if dest.exists():
        return dest
    key = _key_from_url(url)
    if not remote() or not key:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
        async with http.stream("GET", public_url(key)) as r:
            r.raise_for_status()
            with dest.open("wb") as out:
                async for chunk in r.aiter_bytes():
                    out.write(chunk)
    return dest


async def delete_url(url: str | None) -> None:
    key = _key_from_url(url or "")
    if not key:
        return
    if not remote():
        (Path(settings.UPLOAD_DIR) / key).unlink(missing_ok=True)
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
            await http.request("DELETE", _api(f"object/{settings.STORAGE_BUCKET}"), headers=_headers(), json={"prefixes": [key]})
    except httpx.HTTPError:
        pass


async def delete_prefix(prefix: str) -> None:
    """Delete everything stored under a folder, e.g. one video's files."""
    if not remote():
        import shutil
        shutil.rmtree(Path(settings.UPLOAD_DIR) / prefix, ignore_errors=True)
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
            r = await http.post(_api(f"object/list/{settings.STORAGE_BUCKET}"), headers=_headers(),
                                json={"prefix": prefix.rstrip("/"), "limit": 1000})
            names = [f"{prefix.rstrip('/')}/{o['name']}" for o in (r.json() if r.status_code == 200 else []) if o.get("name")]
            if names:
                await http.request("DELETE", _api(f"object/{settings.STORAGE_BUCKET}"), headers=_headers(), json={"prefixes": names})
    except (httpx.HTTPError, ValueError):
        pass
