"""Runtime configuration from environment variables. Never hard-code secrets."""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(ROOT_DIR / ".env")

DEFAULT_SQLITE = f"sqlite:///{(BACKEND_DIR / 'scdaid.db').as_posix()}"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://127.0.0.1:8000/auth/google/callback",
).strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5182").strip().rstrip("/")
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE).strip() or DEFAULT_SQLITE
SESSION_SECRET = os.getenv("SESSION_SECRET", "").strip()
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower() or "lax"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes"}
COOKIE_NAME = "scdaid_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30

_DEFAULT_CORS = (
    "http://localhost:5182",
    "http://127.0.0.1:5182",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
)


def _as_origin(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return url.rstrip("/")


def google_oauth_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def session_secret() -> str:
    if SESSION_SECRET:
        return SESSION_SECRET
    return "dev-insecure-session-secret-change-me"


def cors_origins() -> list[str]:
    origins = {_as_origin(FRONTEND_URL)}
    extra = os.getenv("CORS_ORIGINS", "")
    for item in extra.split(","):
        value = item.strip()
        if value:
            origins.add(_as_origin(value))
    origins.update(_DEFAULT_CORS)
    return sorted(origin for origin in origins if origin)
