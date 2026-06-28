"""Emergent Object Storage client for RelayLab.

Provides put_object/get_object helpers and a FastAPI startup hook.
Storage path convention: `{APP_NAME}/uploads/{related_type}/{uuid}.{ext}`.
"""
from __future__ import annotations

import os
import logging
from typing import Tuple

import requests

logger = logging.getLogger("relaylab.storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "relaylab")

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB

_storage_key: str | None = None


def init_storage() -> str:
    """Initialize storage session (called once at startup, reusable globally)."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY not set in environment")
    resp = requests.post(
        f"{STORAGE_URL}/init",
        json={"emergent_key": EMERGENT_KEY},
        timeout=30,
    )
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def reset_storage_key():
    global _storage_key
    _storage_key = None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes to storage. Returns {path, size, etag}."""
    key = init_storage()
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
        if resp.status_code == 403:
            # re-init once
            reset_storage_key()
            key = init_storage()
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=120,
            )
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as e:
        logger.exception(f"put_object failed for {path}: {e.response.text if e.response else e}")
        raise


def get_object(path: str) -> Tuple[bytes, str]:
    """Download bytes from storage. Returns (content, content_type)."""
    key = init_storage()
    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        if resp.status_code == 403:
            reset_storage_key()
            key = init_storage()
            resp = requests.get(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=60,
            )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    except requests.HTTPError as e:
        logger.exception(f"get_object failed for {path}: {e.response.status_code if e.response else e}")
        raise
