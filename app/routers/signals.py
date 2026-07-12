from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_usdt_pairs
from app.models.signal import SignalSnapshot
from app.schemas.signals import CoinSignal, SnapshotHistory
from app.services import coinscanx

router = APIRouter(prefix="/signals", tags=["Signals"])


def _enrich_with_binance(coins: list[dict]) -> list[dict]:
    usdt_pairs = get_usdt_pairs()
    for coin in coins:
        pair = f"{coin['symbol']}USDT"
        coin["binance_pair"] = pair if pair in usdt_pairs else None
    return coins


# Nota: los GET de señales no persisten snapshots — de eso se encarga el
# scheduler (app/scheduler.py) cada minuto. Así los GET son idempotentes y
# no se duplican filas en signal_snapshots por cada refresh del frontend.


@router.get("/top10", response_model=list[CoinSignal])
def get_top10(
    limit: int = Query(default=10, ge=1, le=10),
    original: bool = Query(default=False),
    sort: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    coins = coinscanx.fetch_top10(limit=limit, original=original, sort=sort)
    return _enrich_with_binance(coins)


@router.get("/periodo-gracia", response_model=list[CoinSignal])
def get_periodo_gracia(
    limit: int = Query(default=10, ge=1, le=200),
    sort: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    coins = coinscanx.fetch_periodo_gracia(limit=limit, sort=sort)
    return _enrich_with_binance(coins)


@router.get("/history/{symbol}", response_model=list[SnapshotHistory])
def get_history(
    symbol: str,
    source: Optional[str] = Query(default=None, description="top10 o periodo_gracia"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(SignalSnapshot).filter(SignalSnapshot.symbol == symbol.upper())
    if source:
        query = query.filter(SignalSnapshot.source == source)
    snapshots = query.order_by(SignalSnapshot.fetched_at.desc()).limit(limit).all()
    return snapshots


@router.get("/chart/{symbol}")
def get_chart_data(
    symbol: str,
    limit: int = Query(default=60, ge=5, le=300),
    db: Session = Depends(get_db),
):
    from app.config import settings
    snapshots = (
        db.query(SignalSnapshot)
        .filter(SignalSnapshot.symbol == symbol.upper())
        .filter(SignalSnapshot.current_price_usd.isnot(None))
        .order_by(SignalSnapshot.fetched_at.asc())
        .limit(limit)
        .all()
    )
    result = [
        {
            "t": s.fetched_at.isoformat(),
            "price": float(s.current_price_usd),
            "pct": float(s.current_increase_percentage) if s.current_increase_percentage is not None else None,
        }
        for s in snapshots
    ]
    if settings.demo_mode and len(result) < 2:
        from app.demo import chart_data
        return chart_data(symbol)
    return result


@router.get("/rank-chart/{symbol}")
def get_rank_chart_data(
    symbol: str,
    limit: int = Query(default=60, ge=5, le=300),
    db: Session = Depends(get_db),
):
    """Historial de posición en el ranking Top 10 para un símbolo."""
    from app.config import settings
    snapshots = (
        db.query(SignalSnapshot)
        .filter(SignalSnapshot.symbol == symbol.upper())
        .filter(SignalSnapshot.rank.isnot(None))
        .filter(SignalSnapshot.source == "top10")
        .order_by(SignalSnapshot.fetched_at.asc())
        .limit(limit)
        .all()
    )
    result = [
        {
            "t": s.fetched_at.isoformat(),
            "rank": s.rank,
            "pct": float(s.current_increase_percentage) if s.current_increase_percentage is not None else None,
        }
        for s in snapshots
    ]
    if settings.demo_mode and len(result) < 2:
        # Generar ranking fake: empieza en posición 8-10, mejora hasta 1-3
        from app.demo import chart_data
        pts = chart_data(symbol)
        n   = len(pts)
        return [
            {"t": p["t"], "rank": max(1, round(10 - (i / max(n - 1, 1)) * 8)), "pct": p["pct"]}
            for i, p in enumerate(pts)
        ]
    return result


@router.get("/pct-chart/{symbol}")
def get_pct_chart_data(
    symbol: str,
    limit: int = Query(default=60, ge=5, le=300),
    db: Session = Depends(get_db),
):
    """Historial de % de aumento (current_increase_percentage) para un símbolo."""
    from app.config import settings
    snapshots = (
        db.query(SignalSnapshot)
        .filter(SignalSnapshot.symbol == symbol.upper())
        .filter(SignalSnapshot.current_increase_percentage.isnot(None))
        .order_by(SignalSnapshot.fetched_at.asc())
        .limit(limit)
        .all()
    )
    result = [
        {
            "t": s.fetched_at.isoformat(),
            "pct": float(s.current_increase_percentage),
            "source": s.source,
        }
        for s in snapshots
    ]
    if settings.demo_mode and len(result) < 2:
        from app.demo import chart_data
        return [{"t": p["t"], "pct": p["pct"], "source": "top10"} for p in chart_data(symbol)]
    return result


@router.get("/health")
def signals_health():
    return coinscanx.fetch_health()
