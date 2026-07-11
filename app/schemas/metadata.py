from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CoinLookup(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=30)
    name: str = Field(..., min_length=1, max_length=120)


class MetadataBatchRequest(BaseModel):
    coins: list[CoinLookup] = Field(default_factory=list, max_length=250)


class CoinMetadataOut(BaseModel):
    symbol: str
    name: str
    coingecko_id: Optional[str] = None
    coingecko_url: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    twitter_url: Optional[str] = None
    telegram_url: Optional[str] = None
    reddit_url: Optional[str] = None
    github_url: Optional[str] = None
    whitepaper_url: Optional[str] = None
    fetched_at: datetime

    model_config = {"from_attributes": True}


class MetadataBatchResponse(BaseModel):
    provider: str = "coingecko"
    provider_configured: bool
    metadata: dict[str, CoinMetadataOut]
