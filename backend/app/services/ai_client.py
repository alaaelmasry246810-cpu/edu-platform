"""The one AI client every service uses — picks the provider from settings.

AI_PROVIDER=openai  → OpenAI as before (gpt-4o, text-embedding-3-large, whisper, tts-1).
AI_PROVIDER=gemini  → Google Gemini's free tier through its OpenAI-compatible
                      endpoint for chat, vision (OCR) and embeddings; speech-to-text
                      on Groq's free Whisper; text-to-speech with edge-tts (video_service).

Call sites keep the OpenAI SDK shape (client.chat.completions.create(...)); the
requested OpenAI model name is mapped here — "...-mini" means the fast model."""
from openai import AsyncOpenAI

from app.config import settings

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
# Gemini's thinking tokens count toward max_tokens; without headroom short
# answers (scores, titles) come back empty.
_THINKING_HEADROOM = 2048


def gemini() -> bool:
    return settings.AI_PROVIDER.lower() == "gemini"


# Free tiers answer bursts with 429 — the SDK retries those with backoff.
_base = AsyncOpenAI(
    api_key=(settings.GEMINI_API_KEY if gemini() else settings.OPENAI_API_KEY) or "missing",
    base_url=GEMINI_BASE_URL if gemini() else None,
    max_retries=6,
)


class _Completions:
    async def create(self, **kw):
        if gemini():
            kw["model"] = settings.GEMINI_FAST_MODEL if "mini" in str(kw.get("model", "")) else settings.GEMINI_MODEL
            if kw.get("max_tokens"):
                kw["max_tokens"] += _THINKING_HEADROOM
            if settings.GEMINI_REASONING_EFFORT:
                kw["extra_body"] = {"reasoning_effort": settings.GEMINI_REASONING_EFFORT, **(kw.get("extra_body") or {})}
        return await _base.chat.completions.create(**kw)


class _Chat:
    completions = _Completions()


class _Embeddings:
    async def create(self, **kw):
        if gemini():
            kw["model"] = settings.GEMINI_EMBEDDING_MODEL
            kw.setdefault("dimensions", settings.EMBEDDING_DIMENSION)
        return await _base.embeddings.create(**kw)


class _Client:
    chat = _Chat()
    embeddings = _Embeddings()
    audio = _base.audio  # OpenAI only — see transcriber() and video_service.synthesize()


client = _Client()


def transcriber() -> tuple[AsyncOpenAI, str]:
    """(client, model) for speech-to-text: Groq's Whisper when it has a key, else OpenAI's."""
    if settings.GROQ_API_KEY:
        return AsyncOpenAI(api_key=settings.GROQ_API_KEY, base_url=GROQ_BASE_URL, max_retries=4), "whisper-large-v3"
    return _base, "whisper-1"
