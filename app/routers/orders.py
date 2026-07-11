from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from binance.client import Client
from binance.exceptions import BinanceAPIException
from sqlalchemy.orm import Session
from app.dependencies import get_binance_client, binance_http_error
from app.database import get_db
from app.schemas.orders import OCOOrderRequest, LimitOrderRequest
from app.models.order_snapshot import LocalOrder
from app.models.signal import SignalSnapshot
from app.config import settings

router = APIRouter(prefix="/orders", tags=["Orders"])


def _save_local_order(
    db: Session,
    order_reference: str,
    order_type: str,
    symbol: str,
    side: str,
    quantity: float,
    limit_price: Optional[float],
    stop_price: Optional[float],
    binance_price: Optional[float],
) -> None:
    """Guarda metadata local al crear una orden, capturando el snapshot de CoinScanX."""
    base_symbol = symbol.upper()
    if base_symbol.endswith("USDT"):
        base_symbol = base_symbol[:-4]

    snapshot = (
        db.query(SignalSnapshot)
        .filter(SignalSnapshot.symbol == base_symbol)
        .order_by(SignalSnapshot.fetched_at.desc())
        .first()
    )

    local = LocalOrder(
        order_reference=order_reference,
        order_type=order_type,
        symbol=symbol.upper(),
        side=side,
        quantity=quantity,
        limit_price=limit_price,
        stop_price=stop_price,
        coinscanx_price=float(snapshot.current_price_usd) if snapshot and snapshot.current_price_usd else None,
        coinscanx_rank=snapshot.rank if snapshot else None,
        coinscanx_position=snapshot.source if snapshot else None,
        coinscanx_pct=float(snapshot.current_increase_percentage) if snapshot and snapshot.current_increase_percentage is not None else None,
        binance_price_at_launch=binance_price,
    )
    db.add(local)
    db.commit()


@router.get("/open")
def get_open_orders(symbol: Optional[str] = None, client: Client = Depends(get_binance_client)):
    if settings.demo_mode:
        from app.demo import open_orders_response
        return open_orders_response(symbol)
    try:
        if symbol:
            orders = client.get_open_orders(symbol=symbol.upper())
            return {"symbol": symbol.upper(), "open_orders": orders, "count": len(orders)}
        else:
            orders = client.get_open_orders()
            return {"open_orders": orders, "count": len(orders)}
    except BinanceAPIException as e:
        raise binance_http_error(e)


@router.get("/metadata")
def get_orders_metadata(db: Session = Depends(get_db)):
    """Lista los metadatos locales de órdenes guardados (últimas 200)."""
    orders = db.query(LocalOrder).order_by(LocalOrder.created_at.desc()).limit(200).all()
    return [
        {
            "order_reference": o.order_reference,
            "order_type": o.order_type,
            "symbol": o.symbol,
            "side": o.side,
            "quantity": o.quantity,
            "limit_price": o.limit_price,
            "stop_price": o.stop_price,
            "coinscanx_price": o.coinscanx_price,
            "coinscanx_rank": o.coinscanx_rank,
            "coinscanx_position": o.coinscanx_position,
            "coinscanx_pct": o.coinscanx_pct,
            "binance_price_at_launch": o.binance_price_at_launch,
            "created_at": o.created_at.isoformat(),
        }
        for o in orders
    ]


@router.post("/limit")
def place_limit_order(
    order: LimitOrderRequest,
    client: Client = Depends(get_binance_client),
    db: Session = Depends(get_db),
):
    """Coloca una orden LIMIT en Binance y guarda metadata de CoinScanX."""
    if settings.demo_mode:
        from app.demo import place_order_ok
        result = place_order_ok(order.symbol, order.side, "LIMIT", order.quantity, order.price)
        _save_local_order(
            db=db,
            order_reference=str(result.get("orderId", "")),
            order_type="LIMIT",
            symbol=order.symbol.upper(),
            side=order.side,
            quantity=order.quantity,
            limit_price=order.price,
            stop_price=None,
            binance_price=order.price,
        )
        return result
    try:
        result = client.create_order(
            symbol=order.symbol.upper(),
            side=order.side,
            type="LIMIT",
            timeInForce="GTC",
            quantity=order.quantity,
            price=str(order.price),
        )
    except BinanceAPIException as e:
        raise binance_http_error(e)

    try:
        ticker = client.get_symbol_ticker(symbol=order.symbol.upper())
        binance_price = float(ticker["price"])
    except Exception:
        binance_price = order.price

    _save_local_order(
        db=db,
        order_reference=str(result.get("orderId", "")),
        order_type="LIMIT",
        symbol=order.symbol.upper(),
        side=order.side,
        quantity=order.quantity,
        limit_price=order.price,
        stop_price=None,
        binance_price=binance_price,
    )
    return result


@router.post("/oco")
def place_oco_order(
    order: OCOOrderRequest,
    client: Client = Depends(get_binance_client),
    db: Session = Depends(get_db),
):
    """Coloca una orden OCO en Binance y guarda metadata de CoinScanX."""
    if settings.demo_mode:
        from app.demo import place_order_ok
        result = place_order_ok(order.symbol, order.side, "OCO", order.quantity, order.price, stop_price=order.stop_price)
        _save_local_order(
            db=db,
            order_reference=str(result.get("orderListId", "")),
            order_type="OCO",
            symbol=order.symbol.upper(),
            side=order.side,
            quantity=order.quantity,
            limit_price=order.price,
            stop_price=order.stop_price,
            binance_price=order.price,
        )
        return result
    try:
        result = client.create_oco_order(
            symbol=order.symbol.upper(),
            side=order.side,
            quantity=order.quantity,
            price=str(order.price),
            stopPrice=str(order.stop_price),
            stopLimitPrice=str(order.stop_limit_price),
            stopLimitTimeInForce="GTC",
        )
    except BinanceAPIException as e:
        raise binance_http_error(e)

    try:
        ticker = client.get_symbol_ticker(symbol=order.symbol.upper())
        binance_price = float(ticker["price"])
    except Exception:
        binance_price = order.price

    _save_local_order(
        db=db,
        order_reference=str(result.get("orderListId", "")),
        order_type="OCO",
        symbol=order.symbol.upper(),
        side=order.side,
        quantity=order.quantity,
        limit_price=order.price,
        stop_price=order.stop_price,
        binance_price=binance_price,
    )
    return result


@router.delete("/{symbol}/{order_id}")
def cancel_order(symbol: str, order_id: int, client: Client = Depends(get_binance_client)):
    if settings.demo_mode:
        from app.demo import cancel_order_ok
        return cancel_order_ok(symbol, order_id)
    try:
        result = client.cancel_order(symbol=symbol.upper(), orderId=order_id)
        return result
    except BinanceAPIException as e:
        raise binance_http_error(e)
