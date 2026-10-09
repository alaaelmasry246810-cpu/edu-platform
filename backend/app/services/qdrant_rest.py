"""Minimal Qdrant REST client (httpx) — just the calls the RAG service makes.

Replaces qdrant-client, which pulls in grpc/numpy and costs ~55MB of RAM at
import: too much for free hosts with 256MB (e.g. Back4App Containers)."""
import httpx

from app.config import settings


def _base() -> str:
    return (settings.QDRANT_URL or f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}").rstrip("/")


def _client() -> httpx.AsyncClient:
    headers = {"api-key": settings.QDRANT_API_KEY} if settings.QDRANT_API_KEY else {}
    return httpx.AsyncClient(base_url=_base(), headers=headers, timeout=httpx.Timeout(60.0, connect=15.0))


def match_filter(conditions: dict | None) -> dict | None:
    """{"lesson_id": "..."} → Qdrant filter requiring every key to match."""
    if not conditions:
        return None
    return {"must": [{"key": k, "match": {"value": v}} for k, v in conditions.items()]}


async def _call(method: str, path: str, json: dict | None = None, params: dict | None = None) -> dict:
    async with _client() as http:
        r = await http.request(method, path, json=json, params=params)
    if r.status_code >= 400:
        raise RuntimeError(f"Qdrant {method} {path} failed ({r.status_code}): {r.text[:200]}")
    return r.json().get("result") or {}


async def collection_names() -> list[str]:
    result = await _call("GET", "/collections")
    return [c["name"] for c in result.get("collections", [])]


async def create_collection(name: str, size: int) -> None:
    await _call("PUT", f"/collections/{name}", {"vectors": {"size": size, "distance": "Cosine"}})


async def create_keyword_index(name: str, field: str) -> None:
    await _call("PUT", f"/collections/{name}/index", {"field_name": field, "field_schema": "keyword"}, {"wait": "true"})


async def upsert(name: str, points: list[dict]) -> None:
    """points: [{"id": str, "vector": [...], "payload": {...}}]"""
    await _call("PUT", f"/collections/{name}/points", {"points": points}, {"wait": "true"})


async def scroll(name: str, flt: dict | None, limit: int) -> list[dict]:
    """Points (id + payload, no vectors) matching the filter."""
    body = {"limit": limit, "with_payload": True, "with_vector": False}
    if flt:
        body["filter"] = flt
    result = await _call("POST", f"/collections/{name}/points/scroll", body)
    return result.get("points", [])


async def delete(name: str, flt: dict) -> None:
    await _call("POST", f"/collections/{name}/points/delete", {"filter": flt}, {"wait": "true"})
