"""
Authentication checks for Google account sessions.
Run: python backend/test_auth.py
Does not call Google network endpoints.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ["SESSION_SECRET"] = "test-session-secret-not-for-production"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FRONTEND_URL"] = "http://localhost:5182"
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["GOOGLE_CLIENT_SECRET"] = ""

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from auth import (  # noqa: E402
    COOKIE_NAME,
    InvalidGoogleIdentityError,
    UnverifiedEmailError,
    complete_google_sign_in,
    create_auth_session,
    parse_google_identity,
    sign_session,
)
from db import SessionLocal, init_db  # noqa: E402
from models import User  # noqa: E402

init_db()

from app import app  # noqa: E402

client = TestClient(app)


def check(name, ok, detail=""):
    if ok:
        print(f"PASS  {name}")
        return 0
    print(f"FAIL  {name}  {detail}")
    return 1


def google_identity(**overrides):
    identity = {
        "sub": "google-sub-ada",
        "email": "ada@example.com",
        "email_verified": True,
        "name": "Ada Lovelace",
        "picture": "https://example.com/ada.png",
    }
    identity.update(overrides)
    return identity


def main() -> int:
    failed = 0

    me = client.get("/auth/me")
    failed += check(
        "unauthenticated /auth/me",
        me.status_code == 200 and me.json().get("authenticated") is False and me.json().get("user") is None,
        str(me.json()),
    )

    db = SessionLocal()
    try:
        user = complete_google_sign_in(db, google_identity())
        created_id = user.id
        count_after_create = db.query(User).filter(User.google_sub == "google-sub-ada").count()
        failed += check(
            "creating a new user from a mocked valid Google identity",
            user.email == "ada@example.com"
            and user.google_sub == "google-sub-ada"
            and user.role == "user"
            and user.full_name == "Ada Lovelace"
            and count_after_create == 1,
            f"id={user.id} count={count_after_create}",
        )

        again = complete_google_sign_in(
            db,
            google_identity(name="Ada L.", picture="https://example.com/ada2.png"),
        )
        count_after_repeat = db.query(User).count()
        failed += check(
            "logging in existing Google user does not duplicate the account",
            again.id == created_id and count_after_repeat == 1,
            f"first={created_id} second={again.id} count={count_after_repeat}",
        )
    finally:
        db.close()

    unverified_rejected = False
    try:
        parse_google_identity(google_identity(email_verified=False, sub="google-sub-other", email="other@example.com"))
    except UnverifiedEmailError:
        unverified_rejected = True
    failed += check("unverified Google email is rejected", unverified_rejected)

    missing_rejected = False
    try:
        parse_google_identity({"email": "x@example.com", "email_verified": True})
    except InvalidGoogleIdentityError:
        missing_rejected = True
    failed += check("Google identity without sub is rejected", missing_rejected)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.google_sub == "google-sub-ada").one()
        session = create_auth_session(db, user)
        token = sign_session(session.id)
    finally:
        db.close()

    client.cookies.set(COOKIE_NAME, token)
    authed = client.get("/auth/me")
    body = authed.json()
    failed += check(
        "authenticated /auth/me returns the user",
        authed.status_code == 200
        and body.get("authenticated") is True
        and body.get("user", {}).get("email") == "ada@example.com"
        and "google_sub" not in (body.get("user") or {}),
        str(body),
    )

    logged_out = client.post("/auth/logout")
    failed += check(
        "logout response succeeds",
        logged_out.status_code == 200 and logged_out.json().get("authenticated") is False,
        str(logged_out.json()),
    )
    after = client.get("/auth/me")
    failed += check(
        "logout removes authenticated session",
        after.status_code == 200 and after.json().get("authenticated") is False,
        f"me={after.json()}",
    )

    login = client.get("/auth/google/login", follow_redirects=False)
    failed += check(
        "Google login is unavailable until credentials are configured",
        login.status_code == 503,
        str(login.status_code),
    )

    print("")
    print(f"{'ok' if failed == 0 else 'FAILED'}: {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
