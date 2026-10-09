"""Live games (Kahoot-style): the host's screen shows each question, players
join with a PIN from their phones (logged-in or as a guest) and answer; a
correct answer scores more the faster it comes, plus a streak bonus.

Clients poll (host ~1s, players ~1s) — no websockets needed, so it works on
any host and survives restarts since all state lives in the database."""
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserRole
from app.models.activity import Activity, ActivityAttempt, LiveSession, LivePlayer
from app.services import activity_service

router = APIRouter(prefix="/live", tags=["Live games"])

_optional_oauth = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
_GRACE = 3.0             # seconds of network slack after the timer ends (slow mobile data)
_SESSION_TTL = timedelta(hours=12)
_MAX_PLAYERS = 300


async def _optional_user(token: str | None = Depends(_optional_oauth), db: AsyncSession = Depends(get_db)) -> User | None:
    if not token:
        return None
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None


def _elapsed(s: LiveSession) -> float:
    return (datetime.utcnow() - s.question_started_at).total_seconds() if s.question_started_at else 0.0


async def _players(s: LiveSession, db: AsyncSession) -> list[LivePlayer]:
    return list((await db.execute(select(LivePlayer).where(LivePlayer.session_id == s.id))).scalars().all())


def _leaderboard(players: list[LivePlayer], limit: int | None = None) -> list[dict]:
    ranked = sorted(players, key=lambda p: (-p.score, p.joined_at))
    return [{"nickname": p.nickname, "score": p.score, "streak": p.streak} for p in ranked[:limit]]


async def _host_session(session_id: uuid.UUID, user: User, db: AsyncSession) -> LiveSession:
    s = await db.get(LiveSession, session_id)
    if not s or (s.host_id != user.id and user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="Session not found")
    return s


# ── Host ─────────────────────────────────────────────────────

class CreateBody(BaseModel):
    activity_id: uuid.UUID
    time_limit: int | None = None


@router.post("", status_code=201)
async def create_session(body: CreateBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")
    a = await db.get(Activity, body.activity_id)
    if not a or (a.owner_id != user.id and not a.is_public and user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="Activity not found")
    questions = activity_service.build_mcq(a.items or [], seed=uuid.uuid4().hex)
    if not questions:
        raise HTTPException(status_code=400, detail="النشاط محتاج سؤالين على الأقل")

    active_pins = set((await db.execute(
        select(LiveSession.pin).where(LiveSession.status != "ended", LiveSession.created_at > datetime.utcnow() - _SESSION_TTL)
    )).scalars().all())
    pin = next(p for p in (f"{secrets.randbelow(900000) + 100000}" for _ in range(50)) if p not in active_pins)

    s = LiveSession(
        activity_id=a.id, host_id=user.id, pin=pin, questions=questions,
        time_limit=min(max(body.time_limit or a.time_per_question or 20, 5), 120),
    )
    db.add(s)
    a.plays = (a.plays or 0) + 1
    await db.commit()
    return {"id": str(s.id), "pin": pin}


@router.get("/{session_id}/host")
async def host_state(session_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await _host_session(session_id, user, db)
    players = await _players(s, db)
    a = await db.get(Activity, s.activity_id)
    state = {
        "id": str(s.id), "pin": s.pin, "status": s.status, "title": a.title if a else "",
        "index": s.current_index, "total": len(s.questions), "time_limit": s.time_limit,
        "players": [p.nickname for p in sorted(players, key=lambda p: p.joined_at)],
        "player_count": len(players),
    }
    if 0 <= s.current_index < len(s.questions):
        q = s.questions[s.current_index]
        key = str(s.current_index)
        answered = [p.answers.get(key) for p in players if key in (p.answers or {})]
        state.update({
            "question": q,
            "time_left": max(0.0, s.time_limit - _elapsed(s)) if s.status == "question" else 0,
            "answered": len(answered),
        })
        if s.status in ("reveal", "leaderboard", "ended"):
            counts = [0] * len(q["options"])
            for ans in answered:
                if 0 <= ans["choice"] < len(counts):
                    counts[ans["choice"]] += 1
            state["distribution"] = counts
    if s.status in ("leaderboard", "ended", "reveal"):
        state["leaderboard"] = _leaderboard(players, 10)
    return state


class ActionBody(BaseModel):
    action: str   # next | reveal | leaderboard | end


@router.post("/{session_id}/action")
async def host_action(session_id: uuid.UUID, body: ActionBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await _host_session(session_id, user, db)
    if body.action == "next":
        if s.current_index + 1 >= len(s.questions):
            await _finish(s, db)
        else:
            s.current_index += 1
            s.status = "question"
            s.question_started_at = datetime.utcnow()
    elif body.action == "reveal" and s.status == "question":
        s.status = "reveal"
        # Anyone who didn't answer loses their streak.
        key = str(s.current_index)
        for p in await _players(s, db):
            if key not in (p.answers or {}):
                p.streak = 0
    elif body.action == "leaderboard" and s.status == "reveal":
        s.status = "leaderboard"
    elif body.action == "end":
        await _finish(s, db)
    await db.commit()
    return {"status": s.status, "index": s.current_index}


async def _finish(s: LiveSession, db: AsyncSession) -> None:
    """End the game and record each signed-in player's result as an activity attempt."""
    if s.status == "ended":
        return
    s.status = "ended"
    for p in await _players(s, db):
        if not p.user_id:
            continue
        answers = [
            {"i": int(k), "correct": v["correct"], "choice": s.questions[int(k)]["options"][v["choice"]] if 0 <= v["choice"] < len(s.questions[int(k)]["options"]) else "", "ms": v.get("ms", 0)}
            for k, v in (p.answers or {}).items() if int(k) < len(s.questions)
        ]
        db.add(ActivityAttempt(
            activity_id=s.activity_id, user_id=p.user_id, template="live", score=p.score,
            correct=sum(1 for v in (p.answers or {}).values() if v["correct"]), total=len(s.questions), answers=answers,
        ))


class KickBody(BaseModel):
    nickname: str


@router.post("/{session_id}/kick")
async def kick_player(session_id: uuid.UUID, body: KickBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Remove a player — e.g. a guest who joined with an inappropriate nickname."""
    s = await _host_session(session_id, user, db)
    for p in await _players(s, db):
        if p.nickname == body.nickname:
            await db.delete(p)
    await db.commit()
    return {"message": "removed"}


# ── Players ──────────────────────────────────────────────────

class JoinBody(BaseModel):
    pin: str
    nickname: str


@router.post("/join")
async def join(body: JoinBody, user: User | None = Depends(_optional_user), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(
        select(LiveSession).where(
            LiveSession.pin == body.pin.strip(), LiveSession.status != "ended",
            LiveSession.created_at > datetime.utcnow() - _SESSION_TTL,
        ).order_by(LiveSession.created_at.desc())
    )).scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="الكود غلط أو المسابقة خلصت")
    players = await _players(s, db)
    if user:
        mine = next((p for p in players if p.user_id == user.id), None)
        if mine:  # rejoin after a refresh
            return {"player_id": str(mine.id), "token": mine.token, "nickname": mine.nickname, "session_id": str(s.id)}
    if len(players) >= _MAX_PLAYERS:
        raise HTTPException(status_code=409, detail="المسابقة مكتملة")
    base = (body.nickname or (user.full_name if user else "")).strip()[:30] or "لاعب"
    taken = {p.nickname for p in players}
    nickname, n = base, 2
    while nickname in taken:
        nickname, n = f"{base} {n}", n + 1
    p = LivePlayer(session_id=s.id, user_id=user.id if user else None, token=secrets.token_hex(16), nickname=nickname, answers={})
    db.add(p)
    await db.commit()
    return {"player_id": str(p.id), "token": p.token, "nickname": nickname, "session_id": str(s.id)}


async def _player(player_id: uuid.UUID, token: str, db: AsyncSession) -> tuple[LivePlayer, LiveSession]:
    p = await db.get(LivePlayer, player_id)
    if not p or not secrets.compare_digest(p.token, token or ""):
        raise HTTPException(status_code=404, detail="Player not found")
    return p, await db.get(LiveSession, p.session_id)


@router.get("/player/{player_id}")
async def player_state(player_id: uuid.UUID, token: str, db: AsyncSession = Depends(get_db)):
    p, s = await _player(player_id, token, db)
    players = await _players(s, db)
    ranked = sorted(players, key=lambda x: (-x.score, x.joined_at))
    state = {
        "status": s.status, "index": s.current_index, "total": len(s.questions),
        "nickname": p.nickname, "score": p.score, "streak": p.streak,
        "rank": next((i + 1 for i, x in enumerate(ranked) if x.id == p.id), None), "player_count": len(players),
    }
    if 0 <= s.current_index < len(s.questions):
        q = s.questions[s.current_index]
        mine = (p.answers or {}).get(str(s.current_index))
        state.update({
            "question": {"q": q["q"], "options": q["options"]},
            "time_left": max(0.0, s.time_limit - _elapsed(s)) if s.status == "question" else 0,
            "my_answer": mine,
        })
        if s.status != "question":
            state["answer_index"] = q["answer_index"]
    if s.status == "ended":
        state["podium"] = _leaderboard(players, 3)
    return state


class AnswerBody(BaseModel):
    token: str
    index: int
    choice: int


@router.post("/player/{player_id}/answer")
async def answer(player_id: uuid.UUID, body: AnswerBody, db: AsyncSession = Depends(get_db)):
    p, s = await _player(player_id, body.token, db)
    if s.status != "question" or body.index != s.current_index:
        raise HTTPException(status_code=409, detail="السؤال انتهى")
    key = str(s.current_index)
    if key in (p.answers or {}):
        return p.answers[key]
    elapsed = _elapsed(s)
    if elapsed > s.time_limit + _GRACE:
        raise HTTPException(status_code=409, detail="الوقت خلص")
    q = s.questions[s.current_index]
    correct = body.choice == q["answer_index"]
    points = 0
    if correct:
        speed = max(0.0, min(1.0, elapsed / s.time_limit))
        p.streak = (p.streak or 0) + 1
        points = round(1000 * (1 - speed / 2)) + min(p.streak - 1, 5) * 100
    else:
        p.streak = 0
    p.score = (p.score or 0) + points
    result = {"choice": body.choice, "correct": correct, "points": points, "ms": int(elapsed * 1000)}
    p.answers = {**(p.answers or {}), key: result}
    await db.commit()
    return result
