from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class LocalOrder(Base):
    """Metadata local guardada al crear una orden (LIMIT o OCO)."""
    __tablename__ = "local_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Referencia a la orden en Binance (orderId para LIMIT, orderListId para OCO)
    order_reference: Mapped[str] = mapped_column(String, nullable=False, index=True)
    order_type: Mapped[str] = mapped_column(String, nullable=False)  # LIMIT | OCO
    symbol: Mapped[str] = mapped_column(String, nullable=False, index=True)
    side: Mapped[str] = mapped_column(String, nullable=False)  # BUY | SELL
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    limit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stop_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Snapshot de CoinScanX al momento de crear la orden
    coinscanx_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    coinscanx_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    coinscanx_position: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # top10 | periodo_gracia
    coinscanx_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Precio de Binance al momento de crear la orden
    binance_price_at_launch: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
