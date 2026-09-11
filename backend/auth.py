"""
Google OAuth / OpenID Connect and SCDAid session cookies.

Google access tokens are not stored. Session cookies are HttpOnly.
Do not log OAuth tokens or authentication cookies.
"""

from __future__ import annotations

import uuid
from datetime import timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse, RedirectResponse

from config import (
    COOKIE_NAME,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    FRONTEND_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    SESSION_MAX_AGE,
    google_oauth_configured,
    session_secret,
)
from models import AuthSession, User, utcnow

oauth = OAuth()
if google_oauth_configured():
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


class UnverifiedEmailError(ValueError):
    pass


class InvalidGoogleIdentityError(ValueError):
    pass


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(session_secret(), salt="scdaid-auth")


def cookie_params() -> dict:
    return {
        "httponly": True,
        "samesite": COOKIE_SAMESITE,
        "secure": COOKIE_SECURE,
        "path": "/",
        "max_age": SESSION_MAX_AGE,
    }


def sign_session(session_id: str) -> str:
    return _serializer().dumps({"sid": session_id})


def read_session(token: str) -> Optional[str]:
    try:
        payload = _serializer().loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None
    session_id = payload.get("sid") if isinstance(payload, dict) else None
    return session_id if isinstance(session_id, str) and session_id else None


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(COOKIE_NAME, sign_session(session_id), **cookie_params())


def clear_session_cookie(response: Response) -> None:
    params = cookie_params()
    response.delete_cookie(
        COOKIE_NAME,
        path=params["path"],
        httponly=params["httponly"],
        samesite=params["samesite"],
        secure=params["secure"],
    )


def _email_verified(value) -> bool:
    if value is True:
        return True
    if isinstance(value, str) and value.strip().lower() in {"true", "1", "yes"}:
        return True
    return False


def parse_google_identity(userinfo: dict) -> dict:
    if not isinstance(userinfo, dict):
        raise InvalidGoogleIdentityError("Missing Google identity.")
    sub = str(userinfo.get("sub") or "").strip()
    email = str(userinfo.get("email") or "").strip().lower()
    if not sub:
        raise InvalidGoogleIdentityError("Google account identifier is missing.")
    if not email:
        raise InvalidGoogleIdentityError("Google email is missing.")
    if not _email_verified(userinfo.get("email_verified")):
        raise UnverifiedEmailError("Google email is not verified.")
    name = userinfo.get("name") or userinfo.get("full_name")
    picture = userinfo.get("picture")
    return {
        "google_sub": sub,
        "email": email,
        "full_name": str(name).strip() if name else None,
        "profile_picture": str(picture).strip() if picture else None,
        "email_verified": True,
    }


def get_or_create_google_user(db: Session, identity: dict) -> User:
    now = utcnow()
    user = db.query(User).filter(User.google_sub == identity["google_sub"]).one_or_none()
    if user:
        user.last_login_at = now
        if identity.get("full_name"):
            user.full_name = identity["full_name"]
        if identity.get("profile_picture"):
            user.profile_picture = identity["profile_picture"]
        user.email_verified = True
        if identity["email"] != user.email:
            taken = db.query(User).filter(User.email == identity["email"], User.id != user.id).one_or_none()
            if taken is None:
                user.email = identity["email"]
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    user = User(
        id=str(uuid.uuid4()),
        google_sub=identity["google_sub"],
        email=identity["email"],
        full_name=identity.get("full_name"),
        profile_picture=identity.get("profile_picture"),
        email_verified=True,
        created_at=now,
        last_login_at=now,
        is_active=True,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def complete_google_sign_in(db: Session, userinfo: dict) -> User:
    identity = parse_google_identity(userinfo)
    return get_or_create_google_user(db, identity)


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "profile_picture": user.profile_picture,
        "role": user.role,
    }


def create_auth_session(db: Session, user: User) -> AuthSession:
    now = utcnow()
    session = AuthSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        created_at=now,
        expires_at=now + timedelta(seconds=SESSION_MAX_AGE),
        revoked_at=None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _session_is_valid(session: Optional[AuthSession]) -> bool:
    if session is None or session.revoked_at is not None:
        return False
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires > utcnow()


def user_from_request(request: Request, db: Session) -> Optional[User]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    session_id = read_session(token)
    if not session_id:
        return None
    session = db.get(AuthSession, session_id)
    if not _session_is_valid(session):
        return None
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        return None
    return user


def revoke_request_session(request: Request, db: Session) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return
    session_id = read_session(token)
    if not session_id:
        return
    session = db.get(AuthSession, session_id)
    if session is None or session.revoked_at is not None:
        return
    session.revoked_at = utcnow()
    db.add(session)
    db.commit()


def frontend_redirect_url() -> str:
    parsed = urlparse(FRONTEND_URL)
    if parsed.scheme and parsed.netloc:
        return FRONTEND_URL
    return "http://localhost:5182"


def _google_client():
    if not google_oauth_configured():
        return None
    return oauth.create_client("google")


async def google_login_redirect(request: Request):
    client = _google_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Google authentication is not configured.")
    return await client.authorize_redirect(request, GOOGLE_REDIRECT_URI)


async def google_callback_response(request: Request, db: Session) -> RedirectResponse:
    client = _google_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Google authentication is not configured.")
    try:
        token = await client.authorize_access_token(request)
    except Exception:
        raise HTTPException(status_code=400, detail="Google authentication failed.") from None
    userinfo = token.get("userinfo") if isinstance(token, dict) else None
    if not userinfo:
        try:
            userinfo = await client.parse_id_token(request, token)
        except Exception:
            userinfo = None
    if not userinfo:
        raise HTTPException(status_code=400, detail="Google identity was not returned.")
    try:
        user = complete_google_sign_in(db, userinfo)
    except UnverifiedEmailError:
        raise HTTPException(status_code=400, detail="A verified Google email is required.") from None
    except InvalidGoogleIdentityError:
        raise HTTPException(status_code=400, detail="Google identity was incomplete.") from None
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is inactive.")
    response = RedirectResponse(frontend_redirect_url(), status_code=302)
    auth_session = create_auth_session(db, user)
    set_session_cookie(response, auth_session.id)
    return response


def me_payload(user: Optional[User]) -> dict:
    if user is None:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": public_user(user)}


def logout_response(request: Request, db: Session) -> JSONResponse:
    revoke_request_session(request, db)
    response = JSONResponse({"ok": True, "authenticated": False})
    clear_session_cookie(response)
    return response
