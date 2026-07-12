import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.user import User
from app.services import auth as auth_svc
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

MIN_PASSWORD_LENGTH = 8

# ── Rate limiting simple en memoria para login ────────────────────────────────
# Bloquea por usuario tras MAX_LOGIN_ATTEMPTS fallos dentro de LOGIN_WINDOW_SECONDS.
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300
_failed_logins: dict[str, list[float]] = {}


def _prune_attempts(key: str) -> list[float]:
    now = time.monotonic()
    attempts = [t for t in _failed_logins.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
    if attempts:
        _failed_logins[key] = attempts
    else:
        _failed_logins.pop(key, None)
    return attempts


def _check_rate_limit(key: str) -> None:
    if len(_prune_attempts(key)) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.",
        )


def _register_failure(key: str) -> None:
    _failed_logins.setdefault(key, []).append(time.monotonic())


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    rate_key = req.username.strip().lower()
    _check_rate_limit(rate_key)

    user = db.query(User).filter(User.username == req.username).first()
    if not user or not auth_svc.verify_password(req.password, user.hashed_password):
        _register_failure(rate_key)
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    _failed_logins.pop(rate_key, None)

    # Migración transparente: re-hashear contraseñas con esquemas viejos (sha256_crypt → bcrypt)
    if auth_svc.needs_rehash(user.hashed_password):
        user.hashed_password = auth_svc.hash_password(req.password)
        db.commit()

    token = auth_svc.create_access_token({"sub": user.username})
    return TokenResponse(access_token=token, username=user.username)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username}


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not auth_svc.verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    current_user.hashed_password = auth_svc.hash_password(req.new_password)
    db.commit()
    return {"message": "Contraseña actualizada exitosamente"}
