from typing import Any
import httpx
from fastapi import HTTPException
from app.config import settings


def _get(endpoint: str, params: dict[str, Any] = {}) -> dict:
    url = f"{settings.coinscanx_base_url}{endpoint}"
    all_params = {"apikey": settings.coinscanx_api_key, **params}
    try:
        response = httpx.get(url, params=all_params, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"CoinScanX error: {e.response.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a CoinScanX: {str(e)}")


def fetch_top10(limit: int = 10, original: bool = False, sort: str = "desc") -> list[dict]:
    params: dict[str, Any] = {"limit": limit, "sort": sort}
    if original:
        params["original"] = "on"
    data = _get("/v3/top10", params)
    return data["data"]["top_criptomonedas"]


def fetch_periodo_gracia(limit: int = 10, sort: str = "desc") -> list[dict]:
    data = _get("/v3/periodo-gracia", {"limit": limit, "sort": sort})
    return data["data"]["monedas_periodo_gracia"]


def fetch_health() -> dict:
    return _get("/v3/health")
