import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base, SessionLocal
from app.dependencies import get_current_user
import app.models.signal          # noqa: F401
import app.models.user             # noqa: F401
import app.models.metadata         # noqa: F401
import app.models.order_snapshot   # noqa: F401
from app.routers import account, market, orders, signals, auth
from app import scheduler as sched

logger = logging.getLogger("signalfaru.main")


def _seed_admin() -> None:
    from app.models.user import User
    from app.services.auth import hash_password
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(username="admin", hashed_password=hash_password("admin")))
            db.commit()
            logger.info("Usuario admin creado con contraseña por defecto: admin/admin")
    finally:
        db.close()


def _seed_demo() -> None:
    """Cuando DEMO_MODE=true pre-inserta metadata de las órdenes demo iniciales."""
    from app.config import settings
    if not settings.demo_mode:
        return
    from app.demo import seed_demo_orders
    db = SessionLocal()
    try:
        seed_demo_orders(db)
        logger.info("Metadata de órdenes demo sembrada correctamente.")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_admin()
    _seed_demo()
    sched.start()
    yield
    sched.stop()


app = FastAPI(
    title="SignalFaru",
    description="API para trading asistido en Binance con señales de CoinScanX",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth router is public (no token required)
app.include_router(auth.router)

# All other API routers require a valid JWT
_auth = [Depends(get_current_user)]
app.include_router(account.router,  dependencies=_auth)
app.include_router(market.router,   dependencies=_auth)
app.include_router(orders.router,   dependencies=_auth)
app.include_router(signals.router,  dependencies=_auth)


@app.get("/api", tags=["Health"])
def api_root():
    from app.config import settings
    return {"status": "ok", "app": "SignalFaru", "version": "0.4.0", "demo": settings.demo_mode}


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
