"""Run a long job after the request (normal servers) or inside it (serverless).

FastAPI's BackgroundTasks run after the response is sent, which a serverless
host like Vercel may cut short. With INLINE_TASKS=true the job is awaited
before responding instead, so it always finishes (within the host's request
time limit). Callers must commit their DB changes first, since jobs open
their own session."""
from typing import Any, Awaitable, Callable

from fastapi import BackgroundTasks

from app.config import settings


async def run_or_schedule(background_tasks: BackgroundTasks, job: Callable[..., Awaitable[Any]], *args: Any) -> None:
    if settings.INLINE_TASKS:
        await job(*args)
    else:
        background_tasks.add_task(job, *args)
