import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.models.signal import SignalSnapshot, SignalSource
from app.services import coinscanx

logger = logging.getLogger("signalfaru.scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


def _save_snapshots(db, source: SignalSource, coins: list[dict]) -> None:
    for coin in coins:
        db.add(SignalSnapshot(
            source=source,
            symbol=coin["symbol"],
            name=coin["name"],
            rank=coin.get("rank"),
            initial_price_usd=coin["initial_price_usd"],
            current_price_usd=coin.get("current_price_usd"),
            max_price_usd=coin["max_price_usd"],
            max_increase_percentage=coin["max_increase_percentage"],
            current_increase_percentage=coin.get("current_increase_percentage"),
            in_top_since=datetime.fromisoformat(coin["in_top_since"]),
            exit_date=datetime.fromisoformat(coin["exit_date"]) if coin.get("exit_date") else None,
            in_top=coin["in_top"],
            volumen24h=coin.get("volumen24h"),
            last_updated=datetime.fromisoformat(coin["last_updated"]) if coin.get("last_updated") else None,
            fetched_at=datetime.utcnow(),
        ))
    db.commit()


def poll_coinscanx() -> None:
    logger.info("Scheduler: polling CoinScanX…")
    db = SessionLocal()
    try:
        top10 = coinscanx.fetch_top10(limit=10, original=True)
        _save_snapshots(db, SignalSource.top10, top10)

        gracia = coinscanx.fetch_periodo_gracia(limit=200)
        _save_snapshots(db, SignalSource.periodo_gracia, gracia)

        logger.info("Scheduler: guardados %d top10 + %d período de gracia", len(top10), len(gracia))
    except Exception as e:
        logger.error("Scheduler: error al polling CoinScanX: %s", e)
    finally:
        db.close()


def start() -> None:
    scheduler.add_job(poll_coinscanx, "interval", minutes=1, id="poll_coinscanx", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler iniciado — polling CoinScanX cada 1 minuto.")


def stop() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Scheduler detenido.")
