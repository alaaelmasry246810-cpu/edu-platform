"""Detect QR codes in page images and fetch the (supported) content they link to.

Kept separate from ocr_service.py so QR handling — a best-effort enrichment
step — never touches the core OCR/parsing code path.
"""
import io
import logging

import httpx

logger = logging.getLogger(__name__)

# Only content types we can feed straight back into DocumentParser.
ALLOWED_CONTENT_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}

MAX_FETCH_BYTES = 25 * 1024 * 1024
FETCH_TIMEOUT_S = 15.0


def detect_qr_urls(img_bytes: bytes) -> list[str]:
    """Return the distinct http(s) URLs encoded in any QR codes found in the image."""
    try:
        # Loaded on demand: Pillow pulls in numpy, too heavy to load at startup on small hosts.
        import zxingcpp
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes))
        results = zxingcpp.read_barcodes(img)
    except Exception:
        logger.exception("QR detection failed on a page image")
        return []

    urls: list[str] = []
    for r in results:
        text = (r.text or "").strip()
        if text.startswith("http://") or text.startswith("https://"):
            if text not in urls:
                urls.append(text)
    return urls


async def fetch_qr_document(url: str) -> tuple[bytes, str] | None:
    """Download the content behind a QR URL if it's a supported document type.

    Returns (content_bytes, extension) or None if the URL can't be used
    (unsupported type, too large, unreachable, etc.) — never raises.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, max_redirects=2, timeout=FETCH_TIMEOUT_S) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                ext = ALLOWED_CONTENT_TYPES.get(content_type)
                if not ext:
                    logger.info("Skipping QR URL with unsupported content-type %s: %s", content_type, url)
                    return None

                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > MAX_FETCH_BYTES:
                    logger.info("Skipping QR URL exceeding size cap: %s", url)
                    return None

                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > MAX_FETCH_BYTES:
                        logger.info("Skipping QR URL exceeding size cap during download: %s", url)
                        return None

                return bytes(chunks), ext
    except Exception:
        logger.exception("Failed to fetch QR-linked document: %s", url)
        return None
