"""Stripe payment integration — checkout sessions, webhook, coupon application."""
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User, SubscriptionPlan
from app.models.coupon import Coupon
from app.middleware.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/payments", tags=["Payments"])

# Stripe price IDs — set these in your .env or Stripe dashboard
PRICE_IDS = {
    "monthly": settings.STRIPE_PRICE_MONTHLY,
    "yearly":  settings.STRIPE_PRICE_YEARLY,
}

PLAN_DURATIONS = {
    "monthly": 31,
    "yearly":  366,
}


def _stripe_client():
    # Imported on first use: the stripe package costs ~35MB of RAM, too much to
    # load on every start on small free hosts when payments aren't even set up.
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


# ── Create Checkout Session ───────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str           # "monthly" | "yearly"
    coupon_code: Optional[str] = None
    success_url: str
    cancel_url: str


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for plan upgrade."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Students only")
    if body.plan not in PRICE_IDS:
        raise HTTPException(status_code=400, detail="خطة غير صحيحة")

    stripe_client = _stripe_client()

    # Resolve coupon (if provided)
    stripe_coupon_id = None
    discount_pct = 0
    if body.coupon_code:
        r = await db.execute(
            select(Coupon).where(
                Coupon.code == body.coupon_code.upper(),
                Coupon.is_active == True,
            )
        )
        coupon = r.scalar_one_or_none()
        if not coupon:
            raise HTTPException(status_code=400, detail="كوبون غير صالح")
        if coupon.expires_at and coupon.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="انتهت صلاحية الكوبون")
        if coupon.max_uses is not None and coupon.times_used >= coupon.max_uses:
            raise HTTPException(status_code=400, detail="استُنفد الكوبون")
        discount_pct = coupon.discount_percent
        # Create or reuse a Stripe coupon
        stripe_coupon_id = f"coupon_{coupon.code}"
        try:
            stripe_client.coupons.retrieve(stripe_coupon_id)
        except stripe_client.error.InvalidRequestError:
            stripe_client.coupons.create(
                id=stripe_coupon_id,
                percent_off=coupon.discount_percent,
                duration="once",
                name=coupon.code,
            )

    # Get or create Stripe customer
    customer_id = current_user.stripe_customer_id
    if not customer_id:
        customer = stripe_client.customers.create(
            email=current_user.email,
            name=current_user.full_name,
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        await db.commit()

    # Build checkout session params
    params = dict(
        customer=customer_id,
        line_items=[{"price": PRICE_IDS[body.plan], "quantity": 1}],
        mode="subscription",
        success_url=body.success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=body.cancel_url,
        metadata={
            "user_id": str(current_user.id),
            "plan":    body.plan,
            "coupon_code": body.coupon_code or "",
        },
        allow_promotion_codes=True,
    )
    if stripe_coupon_id:
        params["discounts"] = [{"coupon": stripe_coupon_id}]

    session = stripe_client.checkout.sessions.create(**params)
    return {"url": session.url, "session_id": session.id}


# ── Stripe Webhook ────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events (checkout.session.completed)."""
    payload = await request.body()
    try:
        event = _stripe_client().Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook signature invalid")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        user_id = meta.get("user_id")
        plan    = meta.get("plan", "monthly")
        coupon_code = meta.get("coupon_code", "")

        if user_id:
            r = await db.execute(select(User).where(User.id == user_id))
            user = r.scalar_one_or_none()
            if user:
                days = PLAN_DURATIONS.get(plan, 31)
                user.plan = SubscriptionPlan(plan)
                user.subscription_expires_at = datetime.utcnow() + timedelta(days=days)
                # Increment coupon usage
                if coupon_code:
                    rc = await db.execute(
                        select(Coupon).where(Coupon.code == coupon_code.upper())
                    )
                    coupon = rc.scalar_one_or_none()
                    if coupon:
                        coupon.times_used += 1
                await db.commit()

    elif event["type"] == "customer.subscription.deleted":
        # Downgrade to free when subscription is cancelled
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        if customer_id:
            r = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
            user = r.scalar_one_or_none()
            if user:
                user.plan = SubscriptionPlan.FREE
                user.subscription_expires_at = None
                await db.commit()

    return {"received": True}


# ── Check Session ─────────────────────────────────────────────

@router.get("/session/{session_id}")
async def check_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Verify a completed checkout session and return current plan."""
    stripe_client = _stripe_client()
    try:
        session = stripe_client.checkout.sessions.retrieve(session_id)
        return {
            "status": session.payment_status,
            "plan": current_user.plan,
            "expires_at": current_user.subscription_expires_at.isoformat() if current_user.subscription_expires_at else None,
        }
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")
