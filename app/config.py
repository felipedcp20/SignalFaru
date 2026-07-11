from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    binance_api_key: str = ""
    binance_api_secret: str = ""
    testnet: bool = True
    coinscanx_api_key: str = "H7jK8mN9pQ0rS1tU2vW3xY4z"
    coinscanx_base_url: str = "https://api.coinscanx.com"
    coingecko_api_key: str = ""
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    database_url: str = "sqlite:///./signalfaru.db"
    jwt_secret: str = "cambia-esto-en-produccion-usa-una-clave-segura-larga"
    demo_mode: bool = False  # Cuando True: datos Binance simulados, sin operaciones reales

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
