import logging
from datetime import datetime, timedelta
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


SNAPSHOT_RETENTION_DAYS = 30


def cleanup_old_snapshots() -> None:
    """Borra snapshots con más de SNAPSHOT_RETENTION_DAYS días para acotar la DB."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=SNAPSHOT_RETENTION_DAYS)
        deleted = (
            db.query(SignalSnapshot)
            .filter(SignalSnapshot.fetched_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
        logger.info("Scheduler: limpieza de snapshots — %d filas eliminadas (> %d días).", deleted, SNAPSHOT_RETENTION_DAYS)
    except Exception as e:
        db.rollback()
        logger.error("Scheduler: error en limpieza de snapshots: %s", e)
    finally:
        db.close()


def start() -> None:
    scheduler.add_job(poll_coinscanx, "interval", minutes=1, id="poll_coinscanx", replace_existing=True)
    scheduler.add_job(cleanup_old_snapshots, "cron", hour=3, minute=0, id="cleanup_snapshots", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler iniciado — polling CoinScanX cada 1 minuto; limpieza diaria de snapshots a las 03:00 UTC.")


def stop() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Scheduler detenido.")
