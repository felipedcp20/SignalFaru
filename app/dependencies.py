import time
from functools import lru_cache
from typing import Optional
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from binance.client import Client
from binance.exceptions import BinanceAPIException
from app.config import settings
from app.database import get_db


def binance_http_error(e: BinanceAPIException) -> HTTPException:
    """
    Convierte un BinanceAPIException en HTTPException sin usar 401/403,
    que el frontend reserva para errores de JWT.
    Los errores de auth de Binance (API key inválida, permisos, IP) se mapean a 400.
    """
    safe_code = 400 if e.status_code in (401, 403) else e.status_code
    return HTTPException(status_code=safe_code, detail=f"Binance: {e.message}")


@lru_cache(maxsize=1)
def get_binance_client() -> Client:
    if settings.demo_mode:
        # En demo mode devolvemos un cliente dummy (las claves pueden estar vacías)
        return Client(api_key="demo", api_secret="demo", testnet=True)
    client = Client(
        api_key=settings.binance_api_key,
        api_secret=settings.binance_api_secret,
        testnet=settings.testnet,
    )
    return client


# Cache con TTL: los pares se refrescan cada hora para captar listados/deslistados
# nuevos de Binance sin reiniciar la app (lru_cache nunca expiraba).
_PAIRS_TTL_SECONDS = 3600.0
_pairs_cache: dict = {"pairs": None, "fetched_at": 0.0}


def get_usdt_pairs() -> set:
    if settings.demo_mode:
        from app.demo import DEMO_USDT_PAIRS
        return DEMO_USDT_PAIRS
    now = time.monotonic()
    if _pairs_cache["pairs"] is None or now - _pairs_cache["fetched_at"] > _PAIRS_TTL_SECONDS:
        client = get_binance_client()
        info = client.get_exchange_info()
        _pairs_cache["pairs"] = {
            s["symbol"] for s in info["symbols"]
            if s["symbol"].endswith("USDT") and s["status"] == "TRADING"
        }
        _pairs_cache["fetched_at"] = now
    return _pairs_cache["pairs"]


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    from app.services.auth import decode_token
    from jose import JWTError

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
