from fastapi import APIRouter, Depends, HTTPException
from binance.client import Client
from binance.exceptions import BinanceAPIException
from app.dependencies import get_binance_client, binance_http_error
from app.config import settings

router = APIRouter(prefix="/account", tags=["Account"])


@router.get("/portfolio")
def get_portfolio(client: Client = Depends(get_binance_client)):
    """Distribución del portafolio con valor en USDT para cada activo."""
    if settings.demo_mode:
        from app.demo import portfolio_response
        return portfolio_response()

    try:
        account = client.get_account()
        raw_balances = [
            b for b in account["balances"]
            if float(b["free"]) + float(b["locked"]) > 0
        ]
    except BinanceAPIException as e:
        raise binance_http_error(e)

    try:
        all_tickers = {t["symbol"]: float(t["price"]) for t in client.get_all_tickers()}
    except BinanceAPIException:
        all_tickers = {}

    portfolio = []
    total_usdt = 0.0

    for b in raw_balances:
        asset = b["asset"]
        qty = float(b["free"]) + float(b["locked"])
        if qty <= 0:
            continue
        if asset == "USDT":
            price_usdt = 1.0
        else:
            price_usdt = all_tickers.get(f"{asset}USDT", 0.0)

        value_usdt = qty * price_usdt
        total_usdt += value_usdt
        portfolio.append({
            "asset": asset,
            "free": round(float(b["free"]), 8),
            "locked": round(float(b["locked"]), 8),
            "total": round(qty, 8),
            "price_usdt": price_usdt,
            "value_usdt": round(value_usdt, 4),
        })

    portfolio.sort(key=lambda x: x["value_usdt"], reverse=True)
    for item in portfolio:
        item["pct"] = round(item["value_usdt"] / total_usdt * 100, 2) if total_usdt > 0 else 0.0

    return {"total_usdt": round(total_usdt, 2), "assets": portfolio}


@router.get("/balance")
def get_balance(client: Client = Depends(get_binance_client)):
    if settings.demo_mode:
        from app.demo import balance_response
        return balance_response()
    try:
        account = client.get_account()
        balances = [
            b for b in account["balances"]
            if float(b["free"]) > 0 or float(b["locked"]) > 0
        ]
        return {"balances": balances}
    except BinanceAPIException as e:
        raise binance_http_error(e)


@router.get("/trades/{symbol}")
def get_trades(symbol: str, client: Client = Depends(get_binance_client)):
    """
    Historial de trades propios para un símbolo (ej: SNX → busca SNXUSDT).
    Calcula P&L realizado y posición actual abierta.
    """
    if settings.demo_mode:
        from app.demo import trades_response
        return trades_response(symbol)

    pair = symbol.upper() if symbol.upper().endswith("USDT") else f"{symbol.upper()}USDT"
    try:
        trades = client.get_my_trades(symbol=pair)
        current_ticker = client.get_symbol_ticker(symbol=pair)
        current_price = float(current_ticker["price"])
    except BinanceAPIException as e:
        raise binance_http_error(e)

    if not trades:
        return {"symbol": pair, "trades": [], "summary": None}

    total_bought_qty = 0.0
    total_bought_cost = 0.0
    total_sold_qty = 0.0
    total_sold_revenue = 0.0

    parsed = []
    for t in trades:
        qty = float(t["qty"])
        price = float(t["price"])
        commission = float(t["commission"])
        is_buyer = t["isBuyer"]

        if is_buyer:
            total_bought_qty += qty
            total_bought_cost += qty * price
        else:
            total_sold_qty += qty
            total_sold_revenue += qty * price

        parsed.append({
            "id": t["id"],
            "side": "BUY" if is_buyer else "SELL",
            "price": price,
            "qty": qty,
            "total_usdt": round(qty * price, 4),
            "commission": commission,
            "commission_asset": t["commissionAsset"],
            "time": t["time"],
        })

    avg_buy_price = total_bought_cost / total_bought_qty if total_bought_qty else 0
    open_position_qty = total_bought_qty - total_sold_qty
    realized_pnl = total_sold_revenue - (avg_buy_price * total_sold_qty) if total_sold_qty else 0
    unrealized_pnl = (current_price - avg_buy_price) * open_position_qty if open_position_qty > 0 else 0

    return {
        "symbol": pair,
        "current_price": current_price,
        "trades": parsed,
        "summary": {
            "total_bought_qty": round(total_bought_qty, 6),
            "total_sold_qty": round(total_sold_qty, 6),
            "open_position_qty": round(open_position_qty, 6),
            "avg_buy_price": round(avg_buy_price, 6),
            "realized_pnl_usdt": round(realized_pnl, 4),
            "unrealized_pnl_usdt": round(unrealized_pnl, 4),
            "total_pnl_usdt": round(realized_pnl + unrealized_pnl, 4),
        },
    }
