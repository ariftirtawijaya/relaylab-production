"""File upload endpoints for Phase P3A (Reference photos + QC evidence)."""
from __future__ import annotations

import uuid
import logging
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Response
from pydantic import BaseModel

from models import FileAsset, now_iso, gen_id
from auth import get_current_user, require_roles
from storage import put_object, get_object, APP_NAME, ALLOWED_MIME, MAX_BYTES

logger = logging.getLogger("relaylab.uploads")

router = APIRouter(prefix="/api")

ALLOWED_RELATED_TYPES = {"bundle", "work_instruction_step", "common_mistake", "qc_evidence"}
EXT_BY_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def get_db(request: Request):
    return request.app.state.db


def _file_url(file_id: str) -> str:
    return f"/api/files/{file_id}"


def _ensure_role_for_upload(user: dict, related_type: str):
    """Admin = all; QC = qc_evidence only; Production = nothing (read-only)."""
    role = user.get("role")
    if role == "Admin":
        return
    if related_type == "qc_evidence" and role == "QC":
        return
    raise HTTPException(status_code=403, detail="Tidak punya hak upload foto untuk kategori ini")


@router.post("/uploads", response_model=None)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    related_type: str = Form(...),
    related_id: str = Form(...),
    product_sku: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    if related_type not in ALLOWED_RELATED_TYPES:
        raise HTTPException(status_code=400, detail=f"related_type tidak valid: {related_type}")
    _ensure_role_for_upload(user, related_type)

    # Read & validate
    data = await file.read()
    size = len(data)
    if size == 0:
        raise HTTPException(status_code=400, detail="File kosong")
    if size > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File terlalu besar (maks 5 MB, ukuran: {size // 1024} KB)")
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail=f"Format tidak didukung: {mime}. Hanya JPG/PNG/WEBP.")

    ext = EXT_BY_MIME[mime]
    file_id = gen_id()
    path = f"{APP_NAME}/uploads/{related_type}/{file_id}.{ext}"

    try:
        result = put_object(path, data, mime)
    except Exception as e:
        logger.exception("Upload to object storage failed")
        raise HTTPException(status_code=502, detail=f"Gagal upload ke storage: {e}")

    db = get_db(request)
    asset = FileAsset(
        id=file_id,
        storage_path=result.get("path", path),
        file_url=_file_url(file_id),
        original_filename=file.filename or f"upload.{ext}",
        mime_type=mime,
        size=result.get("size", size),
        related_type=related_type,
        related_id=related_id,
        product_sku=product_sku,
        caption=caption,
        notes=notes,
        uploaded_by=user.get("name") or user.get("username") or "unknown",
    )
    await db.file_assets.insert_one(asset.model_dump())
    return asset.model_dump()


@router.get("/files/{file_id}")
async def download_file(file_id: str, request: Request):
    """Serve image bytes. Public — no auth required so <img src> works directly.
    Session cookie not needed; thumbnails embedded in print views must be accessible without re-login.
    The id is a UUID — practically unguessable. Access can be tightened later if needed.
    """
    db = get_db(request)
    rec = await db.file_assets.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    try:
        data, ct = get_object(rec["storage_path"])
    except Exception as e:
        logger.exception(f"Download failed for {file_id}")
        raise HTTPException(status_code=502, detail=f"Storage error: {e}")
    headers = {
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": f'inline; filename="{rec.get("original_filename", file_id)}"',
    }
    return Response(content=data, media_type=rec.get("mime_type") or ct, headers=headers)


class FilePatch(BaseModel):
    caption: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/files/{file_id}")
async def patch_file_meta(
    file_id: str,
    payload: FilePatch,
    request: Request,
    user: dict = Depends(require_roles("Admin", "QC")),
):
    db = get_db(request)
    rec = await db.file_assets.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    # QC can only edit qc_evidence
    if user.get("role") == "QC" and rec.get("related_type") != "qc_evidence":
        raise HTTPException(status_code=403, detail="QC hanya bisa mengubah foto QC evidence")
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if update:
        await db.file_assets.update_one({"id": file_id}, {"$set": update})
    return await db.file_assets.find_one({"id": file_id}, {"_id": 0})


@router.delete("/files/{file_id}")
async def delete_file(file_id: str, request: Request, user: dict = Depends(get_current_user)):
    db = get_db(request)
    rec = await db.file_assets.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    role = user.get("role")
    rt = rec.get("related_type")
    # Admin can delete all. QC can delete only qc_evidence.
    if role == "Admin":
        pass
    elif role == "QC" and rt == "qc_evidence":
        pass
    else:
        raise HTTPException(status_code=403, detail="Tidak punya hak hapus foto ini")
    await db.file_assets.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@router.get("/files")
async def list_files(
    request: Request,
    related_type: str,
    related_id: str,
    _: dict = Depends(get_current_user),
):
    if related_type not in ALLOWED_RELATED_TYPES:
        raise HTTPException(status_code=400, detail=f"related_type tidak valid: {related_type}")
    db = get_db(request)
    cur = db.file_assets.find(
        {"related_type": related_type, "related_id": related_id, "is_deleted": False},
        {"_id": 0},
    ).sort("uploaded_at", 1)
    return await cur.to_list(200)


class FilesBulkQuery(BaseModel):
    related_type: str
    related_ids: list[str]


@router.post("/files/bulk-by-related")
async def bulk_files(
    payload: FilesBulkQuery,
    request: Request,
    _: dict = Depends(get_current_user),
):
    """Fetch files for multiple related_ids in one call — used by Bundle Detail/WO Detail."""
    if payload.related_type not in ALLOWED_RELATED_TYPES:
        raise HTTPException(status_code=400, detail="related_type tidak valid")
    if not payload.related_ids:
        return {}
    db = get_db(request)
    cur = db.file_assets.find(
        {"related_type": payload.related_type,
         "related_id": {"$in": payload.related_ids},
         "is_deleted": False},
        {"_id": 0},
    ).sort("uploaded_at", 1)
    docs = await cur.to_list(1000)
    grouped: dict[str, list] = {}
    for d in docs:
        grouped.setdefault(d["related_id"], []).append(d)
    return grouped
