import logging
from datetime import datetime
from typing import Optional
import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.config import settings
from app.models.metadata import CoinMetadata
from app.schemas.metadata import CoinLookup, CoinMetadataOut

logger = logging.getLogger("signalfaru.coingecko")
MAX_FETCH_PER_BATCH = 20


def is_configured() -> bool:
    key = settings.coingecko_api_key.strip()
    return bool(key and not key.startswith("your_"))


def _headers() -> dict[str, str]:
    if not is_configured():
        return {}
    return {"x-cg-demo-api-key": settings.coingecko_api_key.strip()}


def _first_url(values) -> Optional[str]:
    if isinstance(values, list):
        for value in values:
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(values, str) and values.strip():
        return values.strip()
    return None


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _search_coin_id(coin: CoinLookup) -> Optional[str]:
    query = coin.name.strip() or coin.symbol.strip()
    response = httpx.get(
        f"{settings.coingecko_base_url}/search",
        params={"query": query},
        headers=_headers(),
        timeout=12.0,
    )
    response.raise_for_status()
    results = response.json().get("coins", [])
    symbol = coin.symbol.strip().lower()
    name = coin.name.strip().lower()

    exact_name = next(
        (c for c in results if c.get("symbol", "").lower() == symbol and c.get("name", "").lower() == name),
        None,
    )
    if exact_name:
        return exact_name.get("id")

    exact_symbol = next((c for c in results if c.get("symbol", "").lower() == symbol), None)
    if exact_symbol:
        return exact_symbol.get("id")

    return results[0].get("id") if results else None


def _fetch_coin_metadata(coingecko_id: str) -> dict:
    response = httpx.get(
        f"{settings.coingecko_base_url}/coins/{coingecko_id}",
        params={
            "localization": "false",
            "tickers": "false",
            "market_data": "false",
            "community_data": "false",
            "developer_data": "false",
            "sparkline": "false",
        },
        headers=_headers(),
        timeout=12.0,
    )
    response.raise_for_status()
    return response.json()


def _metadata_from_payload(coin: CoinLookup, payload: dict) -> dict:
    links = payload.get("links") or {}
    image = payload.get("image") or {}
    twitter = links.get("twitter_screen_name")
    telegram = links.get("telegram_channel_identifier")
    github = _first_url((links.get("repos_url") or {}).get("github"))
    whitepaper = links.get("whitepaper")

    return {
        "symbol": _normalize_symbol(coin.symbol),
        "name": payload.get("name") or coin.name,
        "coingecko_id": payload.get("id"),
        "coingecko_url": f"https://www.coingecko.com/en/coins/{payload.get('web_slug') or payload.get('id')}",
        "logo_url": image.get("small") or image.get("thumb") or image.get("large"),
        "website_url": _first_url(links.get("homepage")),
        "twitter_url": f"https://x.com/{twitter}" if twitter else None,
        "telegram_url": f"https://t.me/{telegram}" if telegram else None,
        "reddit_url": links.get("subreddit_url") or None,
        "github_url": github,
        "whitepaper_url": whitepaper if isinstance(whitepaper, str) and whitepaper.strip() else None,
        "fetched_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


def _to_out(row: CoinMetadata) -> CoinMetadataOut:
    return CoinMetadataOut.model_validate(row)


def _upsert_metadata(db: Session, values: dict) -> CoinMetadata:
    row = db.query(CoinMetadata).filter(CoinMetadata.symbol == values["symbol"]).first()
    if not row:
        row = CoinMetadata(**values)
        db.add(row)
    else:
        for key, value in values.items():
            setattr(row, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        row = db.query(CoinMetadata).filter(CoinMetadata.symbol == values["symbol"]).first()
        if not row:
            raise
        for key, value in values.items():
            setattr(row, key, value)
        db.commit()
    db.refresh(row)
    return row


def get_or_fetch_batch(db: Session, coins: list[CoinLookup]) -> dict[str, CoinMetadataOut]:
    by_symbol: dict[str, CoinLookup] = {}
    for coin in coins:
        symbol = _normalize_symbol(coin.symbol)
        if symbol:
            by_symbol[symbol] = CoinLookup(symbol=symbol, name=coin.name.strip() or symbol)

    if not by_symbol:
        return {}

    rows = (
        db.query(CoinMetadata)
        .filter(CoinMetadata.symbol.in_(by_symbol.keys()))
        .all()
    )
    found = {row.symbol: _to_out(row) for row in rows}

    if not is_configured():
        return found

    fetched_this_batch = 0
    for symbol, coin in by_symbol.items():
        if symbol in found:
            continue
        if fetched_this_batch >= MAX_FETCH_PER_BATCH:
            break
        try:
            coingecko_id = _search_coin_id(coin)
            if not coingecko_id:
                continue
            payload = _fetch_coin_metadata(coingecko_id)
            found[symbol] = _to_out(_upsert_metadata(db, _metadata_from_payload(coin, payload)))
            fetched_this_batch += 1
        except httpx.HTTPStatusError as exc:
            db.rollback()
            logger.warning("CoinGecko HTTP error for %s: %s", symbol, exc.response.status_code)
        except Exception as exc:
            db.rollback()
            logger.warning("CoinGecko metadata error for %s: %s", symbol, exc)

    return found
