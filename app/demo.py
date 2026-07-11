"""
Datos simulados para DEMO_MODE=true.
Las órdenes se guardan en memoria — se pueden crear y cancelar durante la sesión.
"""
from __future__ import annotations
import math
import random
import time
from datetime import datetime, timezone
from typing import Optional

# ── Pares USDT disponibles ────────────────────────────────────────────────────
DEMO_USDT_PAIRS: set[str] = {
    "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT",
    "AVAXUSDT","DOTUSDT","MATICUSDT","LINKUSDT","LTCUSDT","UNIUSDT","ATOMUSDT",
    "ETCUSDT","XLMUSDT","NEARUSDT","ALGOUSDT","APTUSDT","INJUSDT","SUIUSDT",
    "ARBUSDT","OPUSDT","FETUSDT","WLDUSDT","RUNEUSDT","AAVEUSDT","MKRUSDT",
    "SNXUSDT","COMPUSDT","CRVUSDT","SUSHIUSDT","1INCHUSDT","YFIUSDT",
    "FTMUSDT","GALAUSDT","SANDUSDT","MANAUSDT","APEUSDT","AXSUSDT","CHZUSDT",
    "FLOKIUSDT","PEPEUSDT","SHIBUSDT","BONKUSDT","WIFUSDT","MEMEUSDT",
    "ENAUSDT","TIAUSDT","JUPUSDT","PYTHUSDT","STRKUSDT","ALTUSDT",
    "SEIUSDT","KASUSDT","MOVEUSDT","VIRTUALUSDT",
}

# ── Precio BTC demo ───────────────────────────────────────────────────────────
def btc_price() -> float:
    return round(67_500.0 + random.uniform(-300, 300), 2)

# ── Balance demo ──────────────────────────────────────────────────────────────
DEMO_BALANCES = [
    {"asset": "USDT", "free": "1423.80",    "locked": "0.00"},
    {"asset": "BTC",  "free": "0.00380000", "locked": "0.00"},
    {"asset": "ETH",  "free": "0.42000000", "locked": "0.42000000"},
    {"asset": "SOL",  "free": "3.20000000", "locked": "0.00"},
    {"asset": "BNB",  "free": "0.85000000", "locked": "0.00"},
    {"asset": "LINK", "free": "18.000000",  "locked": "0.00"},
    {"asset": "INJ",  "free": "4.50000000", "locked": "0.00"},
]

def balance_response() -> dict:
    return {"balances": DEMO_BALANCES}

# ── Portfolio demo ────────────────────────────────────────────────────────────
_DEMO_PRICES = {
    "USDT": 1.0, "BTC": 67_500.0, "ETH": 3_180.0,
    "SOL": 148.0, "BNB": 585.0, "LINK": 14.2, "INJ": 28.5,
}

def portfolio_response() -> dict:
    assets = []
    total = 0.0
    for b in DEMO_BALANCES:
        asset = b["asset"]
        qty   = float(b["free"]) + float(b["locked"])
        price = _DEMO_PRICES.get(asset, 0.0)
        val   = qty * price
        total += val
        assets.append({
            "asset": asset,
            "free":   round(float(b["free"]),   8),
            "locked": round(float(b["locked"]), 8),
            "total":  round(qty, 8),
            "price_usdt": price,
            "value_usdt": round(val, 4),
        })
    assets.sort(key=lambda x: x["value_usdt"], reverse=True)
    for a in assets:
        a["pct"] = round(a["value_usdt"] / total * 100, 2) if total else 0.0
    return {"total_usdt": round(total, 2), "assets": assets}

# ── Trades demo ───────────────────────────────────────────────────────────────
def trades_response(symbol: str) -> dict:
    pair = symbol.upper() if symbol.upper().endswith("USDT") else f"{symbol.upper()}USDT"
    base = symbol.upper().replace("USDT", "")
    now_ms = int(time.time() * 1000)

    if "ETH" in pair:
        trades = [
            {"id": 1001, "side": "BUY",  "price": 2_850.0, "qty": 0.42, "total_usdt": round(2_850*0.42,4), "commission": 0.00042, "commission_asset": "ETH", "time": now_ms - 14*86_400_000},
            {"id": 1002, "side": "BUY",  "price": 3_050.0, "qty": 0.21, "total_usdt": round(3_050*0.21,4), "commission": 0.00021, "commission_asset": "ETH", "time": now_ms -  7*86_400_000},
            {"id": 1003, "side": "SELL", "price": 3_400.0, "qty": 0.21, "total_usdt": round(3_400*0.21,4), "commission": 0.00021, "commission_asset": "ETH", "time": now_ms -  2*86_400_000},
        ]
    else:
        trades = [
            {"id": 2001, "side": "BUY",  "price": 110.0, "qty": 3.2, "total_usdt": round(110*3.2,4),  "commission": 0.003,  "commission_asset": base, "time": now_ms - 10*86_400_000},
            {"id": 2002, "side": "SELL", "price": 155.0, "qty": 1.6, "total_usdt": round(155*1.6,4),  "commission": 0.0016, "commission_asset": base, "time": now_ms -  3*86_400_000},
        ]

    total_bought_qty  = sum(t["qty"]           for t in trades if t["side"] == "BUY")
    total_bought_cost = sum(t["qty"] * t["price"] for t in trades if t["side"] == "BUY")
    total_sold_qty    = sum(t["qty"]           for t in trades if t["side"] == "SELL")
    total_sold_rev    = sum(t["qty"] * t["price"] for t in trades if t["side"] == "SELL")
    avg_buy     = total_bought_cost / total_bought_qty if total_bought_qty else 0
    open_qty    = total_bought_qty - total_sold_qty
    cur_price   = _DEMO_PRICES.get(base, 148.0)
    realized    = total_sold_rev - avg_buy * total_sold_qty
    unrealized  = (cur_price - avg_buy) * open_qty if open_qty > 0 else 0

    return {
        "symbol": pair,
        "current_price": cur_price,
        "trades": trades,
        "summary": {
            "total_bought_qty":   round(total_bought_qty, 6),
            "total_sold_qty":     round(total_sold_qty, 6),
            "open_position_qty":  round(open_qty, 6),
            "avg_buy_price":      round(avg_buy, 6),
            "realized_pnl_usdt":  round(realized, 4),
            "unrealized_pnl_usdt":round(unrealized, 4),
            "total_pnl_usdt":     round(realized + unrealized, 4),
        },
    }

# ═══════════════════════════════════════════════════════════════════════════════
#  ÓRDENES EN MEMORIA — persisten mientras el servidor esté corriendo
# ═══════════════════════════════════════════════════════════════════════════════

_next_order_id    = 9_000_100
_next_list_id     = 8_000_100

# Órdenes iniciales de ejemplo para que el demo se vea poblado desde el inicio
_demo_orders: list[dict] = [
    {
        "orderId": 9_000_001, "orderListId": 8_000_001,
        "symbol": "ETHUSDT", "side": "SELL", "type": "LIMIT_MAKER",
        "origQty": "0.42", "price": "3480.00", "stopPrice": "0.00",
        "status": "NEW", "time": int(time.time() * 1000) - 7_200_000,
    },
    {
        "orderId": 9_000_002, "orderListId": 8_000_001,
        "symbol": "ETHUSDT", "side": "SELL", "type": "STOP_LOSS_LIMIT",
        "origQty": "0.42", "price": "2950.00", "stopPrice": "2960.00",
        "status": "NEW", "time": int(time.time() * 1000) - 7_200_000,
    },
    {
        "orderId": 9_000_003, "orderListId": -1,
        "symbol": "SOLUSDT", "side": "BUY", "type": "LIMIT",
        "origQty": "2.00", "price": "138.50", "stopPrice": "0.00",
        "status": "NEW", "time": int(time.time() * 1000) - 3_600_000,
    },
]


def open_orders_response(symbol: Optional[str] = None) -> dict:
    orders = _demo_orders
    if symbol:
        orders = [o for o in orders if o["symbol"] == symbol.upper()]
    return {"open_orders": list(orders), "count": len(orders)}


def place_order_ok(symbol: str, side: str, order_type: str, qty: float, price: float,
                   stop_price: Optional[float] = None) -> dict:
    global _next_order_id, _next_list_id

    sym = symbol.upper()
    now = int(time.time() * 1000)

    if order_type == "OCO":
        list_id = _next_list_id
        _next_list_id += 1

        # OCO crea dos sub-órdenes
        oid1 = _next_order_id;  _next_order_id += 1
        oid2 = _next_order_id;  _next_order_id += 1

        _demo_orders.append({
            "orderId": oid1, "orderListId": list_id,
            "symbol": sym, "side": side, "type": "LIMIT_MAKER",
            "origQty": str(qty), "price": str(price), "stopPrice": "0.00",
            "status": "NEW", "time": now,
        })
        _demo_orders.append({
            "orderId": oid2, "orderListId": list_id,
            "symbol": sym, "side": side, "type": "STOP_LOSS_LIMIT",
            "origQty": str(qty),
            "price": str(round(stop_price * 0.9995, 6)) if stop_price else str(price),
            "stopPrice": str(stop_price) if stop_price else "0.00",
            "status": "NEW", "time": now,
        })

        return {
            "orderListId": list_id,
            "symbol": sym, "side": side,
            "orders": [{"orderId": oid1}, {"orderId": oid2}],
            "_demo": True,
        }

    else:  # LIMIT
        oid = _next_order_id;  _next_order_id += 1
        _demo_orders.append({
            "orderId": oid, "orderListId": -1,
            "symbol": sym, "side": side, "type": "LIMIT",
            "origQty": str(qty), "price": str(price), "stopPrice": "0.00",
            "status": "NEW", "time": now,
        })
        return {
            "orderId": oid, "orderListId": -1,
            "symbol": sym, "side": side, "type": "LIMIT",
            "origQty": str(qty), "price": str(price),
            "status": "NEW", "_demo": True,
        }


def chart_data(symbol: str) -> list[dict]:
    """
    Genera datos de precio fake para las gráficas en demo mode.
    Simula 72 snapshots (aprox. cada 20 min durante 24h) con tendencia
    realista y ruido senoidal para que la gráfica se vea natural.
    """
    _configs: dict[str, dict] = {
        "ETH":      {"start": 2_910.0,  "end": 3_180.0,  "vol": 0.010},
        "SOL":      {"start": 118.0,    "end": 148.0,    "vol": 0.016},
        "BTC":      {"start": 63_500.0, "end": 67_500.0, "vol": 0.007},
        "BNB":      {"start": 548.0,    "end": 585.0,    "vol": 0.009},
        "LINK":     {"start": 12.2,     "end": 14.2,     "vol": 0.014},
        "INJ":      {"start": 23.5,     "end": 28.5,     "vol": 0.020},
        "AVAX":     {"start": 34.0,     "end": 40.5,     "vol": 0.018},
        "MATIC":    {"start": 0.72,     "end": 0.91,     "vol": 0.022},
        "DOT":      {"start": 7.8,      "end": 9.4,      "vol": 0.017},
        "UNI":      {"start": 9.5,      "end": 11.8,     "vol": 0.019},
        "AAVE":     {"start": 195.0,    "end": 240.0,    "vol": 0.015},
        "SNX":      {"start": 2.8,      "end": 3.5,      "vol": 0.025},
        "AXS":      {"start": 7.2,      "end": 9.1,      "vol": 0.023},
        "PEPE":     {"start": 0.0000082,"end": 0.0000105,"vol": 0.030},
    }

    cfg = _configs.get(symbol.upper())
    if not cfg:
        # Generar datos genéricos para cualquier otro símbolo
        cfg = {"start": 1.0, "end": random.uniform(1.05, 1.35), "vol": 0.020}

    n          = 72
    now_s      = time.time()
    interval_s = 24 * 3600 / n   # 1 punto cada ~20 min

    start_p = cfg["start"]
    end_p   = cfg["end"]
    vol     = cfg["vol"]
    result  = []

    for i in range(n):
        t_s      = now_s - (n - i) * interval_s
        progress = i / (n - 1)

        # Tendencia suave de start → end
        trend = start_p + (end_p - start_p) * progress

        # Ruido multi-frecuencia para que parezca real
        noise = (
            math.sin(i * 0.55 + 0.3)  * vol * 0.45 +
            math.sin(i * 1.20 + 1.1)  * vol * 0.25 +
            math.sin(i * 2.70 + 0.7)  * vol * 0.12 +
            random.gauss(0, vol * 0.10)
        ) * trend

        price = max(trend + noise, start_p * 0.85)
        pct   = ((price - start_p) / start_p) * 100

        d = 6 if price < 0.001 else (4 if price < 1 else 2)
        result.append({
            "t":     datetime.fromtimestamp(t_s, tz=timezone.utc).isoformat(),
            "price": round(price, d),
            "pct":   round(pct, 2),
        })

    return result


def seed_demo_orders(db) -> None:
    """Inserta metadata de las órdenes demo iniciales en la BD (idempotente).
    Se llama en el lifespan cuando DEMO_MODE=true para que las órdenes
    pre-pobladas en _demo_orders aparezcan con metadata desde el arranque.
    """
    from app.models.order_snapshot import LocalOrder

    seeds = [
        # OCO pre-cargado: ETH SELL (orderListId 8_000_001)
        dict(
            order_reference="8000001",
            order_type="OCO",
            symbol="ETHUSDT",
            side="SELL",
            quantity=0.42,
            limit_price=3480.0,
            stop_price=2960.0,
            coinscanx_price=3180.0,
            coinscanx_rank=2,
            coinscanx_position="top10",
            coinscanx_pct=12.5,
            binance_price_at_launch=3180.0,
        ),
        # LIMIT pre-cargado: SOL BUY (orderId 9_000_003)
        dict(
            order_reference="9000003",
            order_type="LIMIT",
            symbol="SOLUSDT",
            side="BUY",
            quantity=2.0,
            limit_price=138.5,
            stop_price=None,
            coinscanx_price=148.0,
            coinscanx_rank=5,
            coinscanx_position="top10",
            coinscanx_pct=8.3,
            binance_price_at_launch=148.0,
        ),
    ]

    for seed in seeds:
        ref = seed["order_reference"]
        exists = db.query(LocalOrder).filter(LocalOrder.order_reference == ref).first()
        if not exists:
            db.add(LocalOrder(**seed))
    db.commit()


def cancel_order_ok(symbol: str, order_id: int) -> dict:
    """Elimina la orden (y su par OCO si aplica) de la lista en memoria."""
    global _demo_orders

    # Buscar la orden a cancelar
    target = next((o for o in _demo_orders if o["orderId"] == order_id), None)

    if target and target.get("orderListId", -1) != -1:
        # Es parte de un OCO → cancelar todas las del mismo orderListId
        list_id = target["orderListId"]
        _demo_orders = [o for o in _demo_orders if o.get("orderListId") != list_id]
    else:
        # Orden individual
        _demo_orders = [o for o in _demo_orders if o["orderId"] != order_id]

    return {
        "symbol": symbol.upper(),
        "orderId": order_id,
        "status": "CANCELED",
        "_demo": True,
    }
