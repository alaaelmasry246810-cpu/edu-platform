from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID
from app.models.user import UserRole, AccountStatus, SubscriptionPlan


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    teacher_code: str | None = None   # optional: student links to a teacher at sign-up


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    status: AccountStatus
    plan: SubscriptionPlan
    teacher_code: str | None = None       # non-null for teachers
    teacher_id: UUID | None = None        # non-null for linked students
    subscription_expires_at: datetime | None
    pages_uploaded_this_month: int
    questions_generated_today: int
    must_change_password: bool = False
    teacher_features: dict | None = None
    channel_links: list | None = None
    suspension_reason: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class AdminUserUpdate(BaseModel):
    status: AccountStatus | None = None
    plan: SubscriptionPlan | None = None
    role: UserRole | None = None


class AdminSettings(BaseModel):
    """Dynamic settings the admin can change at runtime."""
    free_pages_limit: int | None = None
    free_questions_per_day: int | None = None
    free_summaries_per_month: int | None = None
    ai_model: str | None = None
    rag_top_k: int | None = None
    monthly_price_usd: float | None = None
    yearly_price_usd: float | None = None


TokenResponse.model_rebuild()
