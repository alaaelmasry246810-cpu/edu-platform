"""Admin-managed notes about where this platform is deployed — three fixed
slots (local / cloud / future) the admin fills in themselves. Purely
informational: nothing else in the app reads these values."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class DeploymentServer(Base):
    __tablename__ = "deployment_servers"

    # Fixed identifiers: "local" | "cloud" | "future"
    slot: Mapped[str] = mapped_column(String(20), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), default="")
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
