from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CoinSignal(BaseModel):
    symbol: str
    name: str
    rank: Optional[int] = None
    initial_price_usd: float
    current_price_usd: Optional[float] = None
    max_price_usd: float
    max_increase_percentage: float
    current_increase_percentage: Optional[float] = None
    in_top_since: datetime
    exit_date: Optional[datetime] = None
    in_top: bool
    volumen24h: Optional[float] = None
    last_updated: Optional[datetime] = None
    binance_pair: Optional[str] = None  # "SNXUSDT" si existe en Binance, null si no

    model_config = {"from_attributes": True}


class SnapshotHistory(CoinSignal):
    id: int
    source: str
    fetched_at: datetime
