"""HTTP routes for Google authentication and the current-user session."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from auth import (
    google_callback_response,
    google_login_redirect,
    logout_response,
    me_payload,
    user_from_request,
)
from db import get_db

router = APIRouter()


@router.get("/auth/google/login")
async def auth_google_login(request: Request):
    return await google_login_redirect(request)


@router.get("/auth/google/callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    return await google_callback_response(request, db)


@router.get("/auth/me")
def auth_me(request: Request, db: Session = Depends(get_db)):
    return me_payload(user_from_request(request, db))


@router.post("/auth/logout")
def auth_logout(request: Request, db: Session = Depends(get_db)):
    return logout_response(request, db)
