import uuid, secrets, string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, AccountStatus, UserRole
from app.schemas.user import RegisterRequest, LoginRequest, TokenResponse, UserPublic, ChangePasswordRequest
from app.middleware.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user
)

from app.services import teachers as links

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_teacher_code(length: int = 8) -> str:
    """Generate a short, human-readable teacher join code (uppercase alpha-num)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _generate_student_code(teacher: User, db: AsyncSession) -> str:
    """Student code derived from their teacher's code, e.g. 'T-AB12CD-03'."""
    return await links.next_student_code(db, teacher)


class TeacherRegisterRequest(RegisterRequest):
    """Extra field so teachers can self-register via a different endpoint."""
    pass


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Student registration — optionally link to a teacher via teacher_code."""
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    phone_taken = await db.execute(select(User).where(User.phone == body.phone))
    if phone_taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Phone number already registered")

    teacher = None
    student_code = None
    teacher_code = getattr(body, "teacher_code", None)
    if teacher_code:
        tc_result = await db.execute(
            select(User).where(User.teacher_code == teacher_code.upper().strip())
        )
        teacher = tc_result.scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher code not found")
        student_code = await _generate_student_code(teacher, db)

    user = User(
        email=body.email.lower(),
        phone=body.phone,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=UserRole.STUDENT,
        status=AccountStatus.PENDING,
        teacher_id=teacher.id if teacher else None,
        student_code=student_code,
        must_change_password=False,
    )
    db.add(user)
    if teacher:
        await db.flush()
        await links.link(db, teacher, user)
    await db.commit()
    return {
        "message": "Account created. Awaiting admin activation.",
        "user_id": str(user.id),
        "linked_teacher": teacher is not None,
        "student_code": user.student_code,
    }


@router.post("/register/teacher", status_code=201)
async def register_teacher(body: TeacherRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Teacher self-registration. A unique teacher_code is auto-generated."""
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    phone_taken = await db.execute(select(User).where(User.phone == body.phone))
    if phone_taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Phone number already registered")

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
        phone=body.phone,
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
    result = await db.execute(select(User).where(User.phone == body.phone.strip()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")

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


# ── A student's teachers (they can study with several) ───────

def _require_student(user: User) -> None:
    if user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")


@router.get("/my-teachers")
async def my_teachers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The student's teachers; `active` is the one whose content they see now."""
    _require_student(current_user)
    from app.models.teacher_student import TeacherStudent
    rows = (await db.execute(
        select(User, TeacherStudent.student_code)
        .join(TeacherStudent, TeacherStudent.teacher_id == User.id)
        .where(TeacherStudent.student_id == current_user.id)
        .order_by(TeacherStudent.created_at)
    )).all()
    return [{"id": str(t.id), "full_name": t.full_name, "student_code": code, "active": t.id == current_user.teacher_id}
            for t, code in rows]


class JoinTeacherRequest(BaseModel):
    teacher_code: str


@router.post("/my-teachers")
async def join_teacher(body: JoinTeacherRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Join another teacher with their code; that teacher becomes the active one."""
    _require_student(current_user)
    teacher = (await db.execute(
        select(User).where(User.teacher_code == body.teacher_code.upper().strip(), User.role == UserRole.TEACHER)
    )).scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="كود المدرس غير صحيح")
    already = await links.is_student_of(db, teacher.id, current_user.id)
    await links.link(db, teacher, current_user)
    current_user.teacher_id = teacher.id
    if not already:
        from app.services.notification_service import notify
        await notify(db, user_id=teacher.id, title="طالب جديد انضم ليك",
                     body=f"{current_user.full_name} انضم لطلابك بكود المدرس", notif_type="info")
    await db.commit()
    return {"teacher_id": str(teacher.id), "full_name": teacher.full_name, "already": already}


@router.post("/my-teachers/{teacher_id}/activate")
async def activate_teacher(teacher_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Switch which teacher's curricula/assignments/activities the student sees."""
    _require_student(current_user)
    if not await links.is_student_of(db, teacher_id, current_user.id):
        raise HTTPException(status_code=404, detail="المدرس ده مش من مدرسينك")
    current_user.teacher_id = teacher_id
    await db.commit()
    return {"active_teacher_id": str(teacher_id)}


@router.delete("/my-teachers/{teacher_id}")
async def leave_teacher(teacher_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_student(current_user)
    if not await links.is_student_of(db, teacher_id, current_user.id):
        raise HTTPException(status_code=404, detail="المدرس ده مش من مدرسينك")
    await links.unlink(db, teacher_id, current_user)
    await db.commit()
    return {"active_teacher_id": str(current_user.teacher_id) if current_user.teacher_id else None}
