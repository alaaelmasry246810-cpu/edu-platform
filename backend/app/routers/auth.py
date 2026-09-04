import uuid, secrets, string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.user import User, AccountStatus, UserRole
from app.schemas.user import RegisterRequest, LoginRequest, TokenResponse, UserPublic, ChangePasswordRequest
from app.middleware.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_teacher_code(length: int = 8) -> str:
    """Generate a short, human-readable teacher join code (uppercase alpha-num)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class TeacherRegisterRequest(RegisterRequest):
    """Extra field so teachers can self-register via a different endpoint."""
    pass


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Student registration — optionally link to a teacher via teacher_code."""
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    teacher_id = None
    # If body carries teacher_code, resolve it
    teacher_code = getattr(body, "teacher_code", None)
    if teacher_code:
        tc_result = await db.execute(
            select(User).where(User.teacher_code == teacher_code.upper().strip())
        )
        teacher = tc_result.scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher code not found")
        teacher_id = teacher.id

    user = User(
        email=body.email.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=UserRole.STUDENT,
        status=AccountStatus.PENDING,
        teacher_id=teacher_id,
        must_change_password=False,
    )
    db.add(user)
    await db.commit()
    return {
        "message": "Account created. Awaiting admin activation.",
        "user_id": str(user.id),
        "linked_teacher": teacher_id is not None,
    }


@router.post("/register/teacher", status_code=201)
async def register_teacher(body: TeacherRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Teacher self-registration. A unique teacher_code is auto-generated."""
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Generate unique teacher code
    for _ in range(10):
        code = _generate_teacher_code()
        exists = await db.execute(select(User).where(User.teacher_code == code))
        if not exists.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique teacher code")

    user = User(
        email=body.email.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=UserRole.TEACHER,
        status=AccountStatus.PENDING,
        teacher_code=code,
        must_change_password=False,
    )
    db.add(user)
    await db.commit()
    return {
        "message": "Teacher account created. Awaiting admin activation.",
        "user_id": str(user.id),
        "teacher_code": code,
    }


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.status == AccountStatus.PENDING:
        raise HTTPException(status_code=403, detail="Account pending admin activation")
    if user.status == AccountStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account suspended")
    if user.status == AccountStatus.REJECTED:
        raise HTTPException(status_code=403, detail="Account rejected")

    user.last_login = datetime.utcnow()

    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserPublic.model_validate(user)
    )


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)):
    return UserPublic.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a new password (required flow when must_change_password is true, but usable anytime)."""
    current_user.hashed_password = hash_password(body.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح"}


@router.post("/report-devtools")
async def report_devtools(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-suspends the calling account — triggered client-side when
    DevTools usage is (heuristically) detected. Note: this heuristic can
    false-positive on legitimate users (different screen sizes, browser
    extensions, accessibility tools, etc.) — an admin or the student's
    teacher can reactivate the account from their dashboard at any time."""
    current_user.status = AccountStatus.SUSPENDED
    current_user.suspension_reason = "devtools_detected"
    await db.commit()
    return {"message": "Account suspended"}


@router.get("/teacher-code")
async def get_my_teacher_code(current_user: User = Depends(get_current_user)):
    """Teachers retrieve their join code to share with students."""
    if current_user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")
    return {"teacher_code": current_user.teacher_code}
