# SignalFaru

SignalFaru es una app web local para hacer seguimiento de señales cripto de CoinScanX y operar pares Spot en Binance desde un panel protegido con login.

La aplicación combina un backend FastAPI, una base SQLite persistente, un scheduler de polling y un frontend SPA servido por el mismo servidor.

## Requisito Previo: Suscripción a CoinScanX

> **Importante:** Para usar SignalFaru necesitás una cuenta con suscripción activa en **[https://coinscanx.com/?ref=JNCFB3](https://coinscanx.com/?ref=JNCFB3)**.
>
> Las señales (Top 10 y Período de gracia) provienen de la API de CoinScanX. Sin una suscripción vigente y su `COINSCANX_API_KEY` correspondiente, la app no puede obtener señales y las funciones principales no operan.
>
> Registrate y suscribite con este enlace de invitación 👉 [https://coinscanx.com/?ref=JNCFB3](https://coinscanx.com/?ref=JNCFB3), obtené tu API key y cargala en la variable de entorno `COINSCANX_API_KEY` (ver [Variables de Entorno](#variables-de-entorno)).

## Qué Hace

- Consulta señales de CoinScanX:
  - Top 10 de criptomonedas.
  - Monedas en período de gracia, hasta el máximo configurado por el backend.
- Enriquece las señales verificando si existe par `USDT` operable en Binance.
- Guarda snapshots históricos de señales en SQLite.
- Muestra dashboard con BTC, saldo USDT, señales activas y órdenes abiertas.
- Permite seleccionar una señal y abrir una pantalla de operación.
- Calcula órdenes OCO con take-profit y stop-loss por porcentaje.
- Envía órdenes OCO a Binance Spot.
- Lista y cancela órdenes abiertas.
- Consulta historial de trades propios por símbolo.
- Calcula P&L realizado, P&L abierto y posición actual.
- Muestra gráfico histórico de precios usando snapshots guardados.
- Añade enlaces externos a CoinMarketCap para revisar cada moneda.
- Obtiene y cachea metadata social desde CoinGecko: Website, X, Telegram, Reddit, GitHub, whitepaper y CoinGecko.
- Tiene autenticación con JWT y cambio de contraseña desde el panel.

## Stack

### Backend

- FastAPI
- SQLAlchemy
- SQLite
- APScheduler
- python-binance
- httpx
- python-jose
- passlib
- pydantic-settings
- CoinGecko Demo API para metadata social

### Frontend

- HTML, CSS y JavaScript vanilla.
- SPA con navegación por pestañas.
- Chart.js para gráficos.
- Logos de monedas vía CDN.
- Token JWT guardado en `localStorage`.

## Estructura

```text
app/
  main.py              # FastAPI app, routers, frontend estático y lifespan
  config.py            # Variables de entorno
  database.py          # Engine, sesión y Base SQLAlchemy
  dependencies.py      # Binance client, pares USDT y auth dependency
  scheduler.py         # Polling automático de CoinScanX
  models/
    signal.py          # Snapshots de señales
    user.py            # Usuario local
    metadata.py        # Cache local de metadata social por moneda
  routers/
    auth.py            # Login, /me y cambio de contraseña
    account.py         # Balance y trades propios
    market.py          # Precio BTC y precio por símbolo
    orders.py          # Órdenes abiertas, OCO y cancelación
    signals.py         # Señales, historial, chart y health CoinScanX
  services/
    auth.py            # Hash, verify y JWT
    coinscanx.py       # Cliente CoinScanX
    coingecko.py       # Cliente CoinGecko y cache de redes
frontend/
  index.html
  styles.css
  app.js
```

## Flujo de Uso

1. Inicias sesión en el navegador.
2. El dashboard carga:
   - precio BTC/USDT,
   - saldo Spot,
   - conteo de señales,
   - órdenes abiertas.
3. En Señales puedes ver Top 10 y Período de gracia.
4. Al elegir una moneda disponible en Binance, la app abre Operar.
5. Operar muestra:
   - precio actual,
   - cambio desde entrada,
   - volumen,
   - historial gráfico,
   - órdenes abiertas del par,
   - P&L si existen trades.
6. Definís lado `BUY` o `SELL`, porcentaje de inversión, take-profit y stop-loss.
7. La app envía una orden OCO a Binance.

## Autenticación

En el primer arranque, la app crea un usuario por defecto:

```text
usuario: admin
contraseña: admin
```

Cambiá esa contraseña desde la pestaña Administración apenas entres por primera vez.

Los endpoints funcionales están protegidos con JWT. El router `/auth` es público para login, pero `/auth/me` y `/auth/change-password` requieren token.

## Variables de Entorno

Creá tu `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Variables principales:

```env
BINANCE_API_KEY=tu_api_key_de_binance
BINANCE_API_SECRET=tu_api_secret_de_binance
TESTNET=false

DEMO_MODE=false

COINSCANX_API_KEY=tu_api_key_de_coinscanx
COINGECKO_API_KEY=tu_demo_api_key_gratis_de_coingecko

JWT_SECRET=una_cadena_larga_y_segura

# Opcional
DATABASE_URL=sqlite:///./signalfaru.db
```

Notas:

- `TESTNET=true` usa Binance testnet.
- `DEMO_MODE=true` usa datos de Binance simulados y **no envía operaciones reales**; ideal para probar o demostrar la app sin claves reales.
- En Docker, `DATABASE_URL` se fuerza a `sqlite:////app/data/signalfaru.db`.
- `.env` no debe commitearse.
- Cambiá `JWT_SECRET` en cualquier entorno real.
- `COINGECKO_API_KEY` es opcional, pero necesaria para poblar redes nuevas desde CoinGecko.
- CoinGecko requiere atribución cuando se usa su Demo API; el frontend muestra enlaces a CoinGecko por moneda.

## Ejecutar con Docker

```bash
docker-compose up -d
```

La app queda disponible en:

- Frontend: http://localhost:8000
- Health/API root: http://localhost:8000/api

Para detener:

```bash
docker-compose down
```

La base SQLite se conserva en el volumen Docker `signalfaru_data`.

## Desarrollo Local

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Luego abrí:

```text
http://localhost:8000
```

## Scheduler

El backend inicia un scheduler al arrancar la app.

Actualmente ejecuta polling de CoinScanX cada 1 minuto:

- consulta Top 10,
- consulta Período de gracia con límite de 200 monedas,
- guarda snapshots en `signal_snapshots`.

Esto permite que el historial y los gráficos se alimenten aunque el frontend no esté abierto.

## Endpoints

### Health

- `GET /api`

Devuelve estado básico de la app:

```json
{"status":"ok","app":"SignalFaru","version":"0.4.0"}
```

### Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/change-password`

### Market

- `GET /market/btc`
- `GET /market/price/{symbol}`
- `POST /market/metadata`

`/market/metadata` recibe una lista de monedas, devuelve metadata social cacheada y consulta CoinGecko solo para símbolos nuevos.
Para proteger el límite gratuito de CoinGecko, el backend resuelve como máximo 20 monedas nuevas por request; el resto se va poblando en los siguientes refresh.

### Account

- `GET /account/balance`
- `GET /account/trades/{symbol}`

`/account/trades/{symbol}` acepta valores como `SNX` o `SNXUSDT` y calcula resumen de P&L.

### Signals

- `GET /signals/top10`
- `GET /signals/periodo-gracia`
- `GET /signals/history/{symbol}`
- `GET /signals/chart/{symbol}`
- `GET /signals/health`

### Orders

- `GET /orders/open`
- `GET /orders/open?symbol=BTCUSDT`
- `POST /orders/oco`
- `DELETE /orders/{symbol}/{order_id}`

Ejemplo de payload OCO:

```json
{
  "symbol": "BTCUSDT",
  "side": "SELL",
  "quantity": 0.001,
  "price": 70000,
  "stop_price": 62000,
  "stop_limit_price": 62000
}
```

## Base de Datos

La app crea tablas automáticamente al arrancar.

Tablas principales:

- `users`: usuario local para login.
- `signal_snapshots`: snapshots históricos de señales CoinScanX.
- `coin_metadata`: cache de redes sociales y links oficiales obtenidos desde CoinGecko.

En ejecución local, por defecto usa:

```text
signalfaru.db
```

En Docker usa:

```text
/app/data/signalfaru.db
```

## Consideraciones de Seguridad

- El usuario inicial `admin/admin` es solo para primer acceso.
- Cambiá la contraseña desde Administración.
- Cambiá `JWT_SECRET`.
- Usá API keys de Binance con permisos mínimos necesarios.
- Para operar en real, revisá muy bien `TESTNET=false`.
- La app ejecuta operaciones Spot reales si las keys tienen permisos y estás fuera de testnet.
- No expongas este servicio públicamente sin endurecer autenticación, CORS y despliegue.

## Notas de Binance

- La app opera contra Spot Wallet.
- El balance mostrado corresponde a saldos de cuenta Spot.
- Si el dinero está en Funding Wallet, transferilo a Spot desde Binance antes de operar.
- No todos los símbolos de CoinScanX existen como par `USDT` en Binance; la app deshabilita operar cuando no encuentra el par.

## Troubleshooting

### El contenedor no inicia

```bash
docker-compose logs signalfaru
```

Revisá que `.env` exista y tenga `BINANCE_API_KEY` y `BINANCE_API_SECRET`.

### No puedo iniciar sesión

Probá el usuario inicial:

```text
admin / admin
```

Si ya cambiaste la contraseña y no la recordás, necesitás revisar o resetear la tabla `users` en SQLite.

### Error de Binance

- Verificá API Key y Secret.
- Verificá permisos de Spot Trading.
- Confirmá si estás usando testnet o producción.
- Revisá restricciones de IP en Binance.

### No aparecen señales

- Verificá `COINSCANX_API_KEY`.
- Consultá `/signals/health`.
- Revisá logs del scheduler.

```bash
docker-compose logs signalfaru
```

### El gráfico dice que no hay historial

El gráfico depende de snapshots guardados en la base. Dejá correr el scheduler unos minutos o abrí Señales para forzar nuevas consultas.

## Versión

Versión actual del backend: `0.4.0`

Última actualización del README: 2026-05-18
