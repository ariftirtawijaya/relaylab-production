"""Session-cookie based auth for RelayLab Production OS."""
import bcrypt
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends
from typing import Optional

SESSION_COOKIE = "rl_session"
SESSION_DAYS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def make_session_token() -> str:
    return str(uuid.uuid4()) + str(uuid.uuid4()).replace("-", "")


def session_expiry_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat()


async def get_current_user(request: Request) -> dict:
    db = request.app.state.db
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    session = await db.sessions.find_one({"token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    # check expiry
    expires_at = session.get("expires_at")
    if expires_at and expires_at < datetime.now(timezone.utc).isoformat():
        await db.sessions.delete_one({"token": token})
        raise HTTPException(status_code=401, detail="Sesi sudah kedaluwarsa")
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Pengguna tidak aktif")
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk role ini")
        return user
    return checker
