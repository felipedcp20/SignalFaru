from fastapi import APIRouter, Depends, HTTPException
from binance.client import Client
from binance.exceptions import BinanceAPIException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_binance_client
from app.schemas.metadata import MetadataBatchRequest, MetadataBatchResponse
from app.services import coingecko
from app.config import settings

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/price/{symbol}")
def get_price(symbol: str, client: Client = Depends(get_binance_client)):
    try:
        ticker = client.get_symbol_ticker(symbol=symbol.upper())
        return {"symbol": ticker["symbol"], "price": float(ticker["price"])}
    except BinanceAPIException as e:
        raise binance_http_error(e)


@router.get("/btc")
def get_btc_price(client: Client = Depends(get_binance_client)):
    if settings.demo_mode:
        from app.demo import btc_price
        return {"symbol": "BTCUSDT", "price": btc_price()}
    try:
        ticker = client.get_symbol_ticker(symbol="BTCUSDT")
        return {"symbol": "BTCUSDT", "price": float(ticker["price"])}
    except BinanceAPIException as e:
        raise binance_http_error(e)


@router.post("/metadata", response_model=MetadataBatchResponse)
def get_coin_metadata(
    req: MetadataBatchRequest,
    db: Session = Depends(get_db),
):
    metadata = coingecko.get_or_fetch_batch(db, req.coins)
    return MetadataBatchResponse(
        provider_configured=coingecko.is_configured(),
        metadata=metadata,
    )
