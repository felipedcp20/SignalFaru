import logging
import secrets
from pydantic_settings import BaseSettings

# Valores de JWT_SECRET conocidos/públicos que nunca deben usarse para firmar tokens
_INSECURE_JWT_SECRETS = {
    "",
    "cambia-esto-en-produccion-usa-una-clave-segura-larga",
    "una_cadena_larga_y_segura",
}
_MIN_JWT_SECRET_LEN = 32


class Settings(BaseSettings):
    binance_api_key: str = ""
    binance_api_secret: str = ""
    testnet: bool = True
    coinscanx_api_key: str = ""
    coinscanx_base_url: str = "https://api.coinscanx.com"
    coingecko_api_key: str = ""
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    database_url: str = "sqlite:///./signalfaru.db"
    jwt_secret: str = ""
    demo_mode: bool = False  # Cuando True: datos Binance simulados, sin operaciones reales

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

if settings.jwt_secret in _INSECURE_JWT_SECRETS or len(settings.jwt_secret) < _MIN_JWT_SECRET_LEN:
    # Nunca firmar tokens con un secreto público/débil: generamos uno efímero.
    # Las sesiones no sobreviven reinicios hasta que se configure JWT_SECRET en .env.
    settings.jwt_secret = secrets.token_hex(32)
    logging.getLogger("signalfaru.config").warning(
        "JWT_SECRET no configurado o inseguro. Se generó un secreto efímero: "
        "los tokens se invalidan en cada reinicio. Configurá JWT_SECRET en .env "
        "(ej: openssl rand -hex 32)."
    )
