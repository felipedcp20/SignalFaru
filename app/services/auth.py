from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

# bcrypt para hashes nuevos; sha256_crypt se mantiene para verificar hashes
# existentes y passlib los marca para re-hash (ver needs_rehash + login).
pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated=["sha256_crypt"])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def needs_rehash(hashed: str) -> bool:
    return pwd_context.needs_update(hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
