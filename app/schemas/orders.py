from pydantic import BaseModel, Field
from typing import Literal


class OCOOrderRequest(BaseModel):
    symbol: str = Field(..., examples=["BTCUSDT"])
    side: Literal["BUY", "SELL"]
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0, description="Precio límite take-profit")
    stop_price: float = Field(..., gt=0, description="Precio de activación del stop")
    stop_limit_price: float = Field(..., gt=0, description="Precio límite del stop")


class LimitOrderRequest(BaseModel):
    symbol: str = Field(..., examples=["BTCUSDT"])
    side: Literal["BUY", "SELL"] = "BUY"
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0, description="Precio límite de la orden")
