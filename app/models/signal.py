from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Float, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import enum


class SignalSource(str, enum.Enum):
    top10 = "top10"
    periodo_gracia = "periodo_gracia"


class SignalSnapshot(Base):
    __tablename__ = "signal_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(SAEnum(SignalSource), nullable=False)
    symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    initial_price_usd: Mapped[float] = mapped_column(Float, nullable=False)
    current_price_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_price_usd: Mapped[float] = mapped_column(Float, nullable=False)
    max_increase_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    current_increase_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    in_top_since: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    exit_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    in_top: Mapped[bool] = mapped_column(Boolean, nullable=False)
    volumen24h: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
