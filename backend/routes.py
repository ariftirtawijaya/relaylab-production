"""All API routes for RelayLab Production OS."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query
from typing import List, Optional
from datetime import datetime, timezone

from models import (
    UserDoc, UserOut, LoginInput, ChangePasswordInput, UserCreateInput, UserUpdateInput,
    Product, CableFunction, MachineProgram, ProductCable, ProductBundle,
    WorkInstruction, RelayPinMap, QcChecklistTemplate, CommonMistake, RevisionHistory,
    WorkOrder, WorkOrderCreateInput, WorkOrderUpdateInput, BatchColor, BatchColorInput,
    QcResult, QcResultInput, TrainingMatrix, CloneProductInput, gen_id, now_iso,
)
from auth import (
    hash_password, verify_password, make_session_token, session_expiry_iso,
    get_current_user, require_roles, SESSION_COOKIE, SESSION_DAYS,
)


router = APIRouter(prefix="/api")


def get_db(request: Request):
    return request.app.state.db


async def _log_revision(db, sku: str, user_name: str, section: str, note: str = ""):
    """Append a simple audit entry to revision_history."""
    prod = await db.products.find_one({"sku": sku}, {"_id": 0, "versi": 1, "status": 1})
    if not prod:
        return
    rev = {
        "id": gen_id(),
        "product_sku": sku,
        "versi": prod.get("versi", "V1"),
        "tanggal": now_iso(),
        "diubah_oleh": user_name,
        "bagian_berubah": section,
        "alasan": note or f"Perubahan otomatis pada {section}",
        "catatan_approval": ("Produk Released — disarankan buat versi baru."
                              if prod.get("status") == "Released" else None),
    }
    await db.revision_history.insert_one(rev)


# ============ AUTH ============
@router.post("/auth/login")
async def login(payload: LoginInput, request: Request, response: Response):
    db = get_db(request)
    user = await db.users.find_one({"username": payload.username}, {"_id": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = make_session_token()
    await db.sessions.insert_one({
        "token": token,
        "user_id": user["id"],
        "created_at": now_iso(),
        "expires_at": session_expiry_iso(),
    })
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=True,
        path="/",
    )
    return {"user": UserOut(**user).model_dump()}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    db = get_db(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@router.post("/auth/change-password")
async def change_password(payload: ChangePasswordInput, request: Request, user: dict = Depends(get_current_user)):
    db = get_db(request)
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not verify_password(payload.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Password saat ini salah")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    return {"ok": True}


# ============ USERS (Admin) ============
@router.get("/users")
async def list_users(request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@router.post("/users")
async def create_user(payload: UserCreateInput, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    existing = await db.users.find_one({"username": payload.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")
    doc = UserDoc(
        name=payload.name, username=payload.username, email=payload.email,
        password_hash=hash_password(payload.password), role=payload.role,
        active=payload.active,
    )
    await db.users.insert_one(doc.model_dump())
    return UserOut(**doc.model_dump())


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateInput, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    await db.users.update_one({"id": user_id}, {"$set": update})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ============ PRODUCTS ============
@router.get("/products")
async def list_products(request: Request, _: dict = Depends(get_current_user), status: Optional[str] = None, q: Optional[str] = None):
    db = get_db(request)
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"sku": {"$regex": q, "$options": "i"}},
            {"nama_produk": {"$regex": q, "$options": "i"}},
            {"nama_pendek": {"$regex": q, "$options": "i"}},
        ]
    return await db.products.find(query, {"_id": 0}).to_list(1000)


@router.get("/products/{sku}")
async def get_product(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    prod = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return prod


@router.post("/products")
async def create_product(payload: Product, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    existing = await db.products.find_one({"sku": payload.sku})
    if existing:
        raise HTTPException(status_code=400, detail="SKU sudah ada")
    payload.created_at = now_iso()
    payload.updated_at = now_iso()
    await db.products.insert_one(payload.model_dump())
    return payload


@router.put("/products/{sku}")
async def update_product(sku: str, payload: Product, request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    existing = await db.products.find_one({"sku": sku})
    if not existing:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    update.pop("id", None)
    update.pop("created_at", None)
    await db.products.update_one({"sku": sku}, {"$set": update})
    return await db.products.find_one({"sku": sku}, {"_id": 0})


@router.post("/products/{sku}/approve")
async def approve_product(sku: str, request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.products.update_one(
        {"sku": sku},
        {"$set": {"status": "Released", "approved_by": user["name"], "updated_at": now_iso()}},
    )
    return await db.products.find_one({"sku": sku}, {"_id": 0})


import re


def _suggest_next_sku(base_sku: str, existing: set) -> str:
    m = re.match(r"^(.+?)V(\d+)$", base_sku)
    if m:
        prefix, n = m.group(1), int(m.group(2)) + 1
    else:
        prefix, n = base_sku + "-V", 2
    while f"{prefix}V{n}" in existing:
        n += 1
    return f"{prefix}V{n}"


@router.get("/products/{sku}/suggest-version")
async def suggest_version(sku: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    source = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    existing = {p["sku"] async for p in db.products.find({}, {"_id": 0, "sku": 1})}
    next_sku = _suggest_next_sku(sku, existing)
    # also suggest next versi label (V2 if current V1, else increment)
    m = re.match(r"^V(\d+)$", source.get("versi") or "V1")
    next_versi = f"V{int(m.group(1)) + 1}" if m else "V2"
    return {"new_sku": next_sku, "new_versi": next_versi, "new_nama_produk": source["nama_produk"]}


@router.post("/products/{sku}/clone")
async def clone_product(sku: str, payload: CloneProductInput, request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    source = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Produk sumber tidak ditemukan")
    if await db.products.find_one({"sku": payload.new_sku}):
        raise HTTPException(status_code=400, detail=f"SKU {payload.new_sku} sudah dipakai")

    version_group = source.get("version_group") or source["sku"]
    new_product = Product(
        sku=payload.new_sku,
        nama_produk=payload.new_nama_produk,
        nama_pendek=source.get("nama_pendek"),
        kategori=source.get("kategori"),
        versi=payload.new_versi,
        status=payload.new_status,
        kapasitas_normal=source.get("kapasitas_normal", 0),
        deskripsi=source.get("deskripsi"),
        konfigurasi=source.get("konfigurasi"),
        catatan_teknis=source.get("catatan_teknis"),
        parent_sku=source["sku"],
        source_sku=source.get("source_sku") or source["sku"],
        version_group=version_group,
    )
    await db.products.insert_one(new_product.model_dump())
    # ensure source has version_group too
    if not source.get("version_group"):
        await db.products.update_one({"sku": source["sku"]}, {"$set": {"version_group": version_group}})

    copied = {}

    if payload.copy_recipe:
        rows = await db.product_cables.find({"product_sku": sku}, {"_id": 0}).to_list(2000)
        for r in rows:
            r["id"] = gen_id()
            r["product_sku"] = payload.new_sku
        if rows:
            await db.product_cables.insert_many(rows)
        copied["recipe"] = len(rows)

    if payload.copy_bundles:
        rows = await db.product_bundles.find({"product_sku": sku}, {"_id": 0}).to_list(500)
        for r in rows:
            r["id"] = gen_id()
            r["product_sku"] = payload.new_sku
        if rows:
            await db.product_bundles.insert_many(rows)
        copied["bundles"] = len(rows)

    if payload.copy_work_instructions:
        rows = await db.work_instructions.find({"product_sku": sku}, {"_id": 0}).to_list(500)
        for r in rows:
            r["id"] = gen_id()
            r["product_sku"] = payload.new_sku
        if rows:
            await db.work_instructions.insert_many(rows)
        copied["work_instructions"] = len(rows)

    if payload.copy_pin_map:
        rows = await db.relay_pin_maps.find({"product_sku": sku}, {"_id": 0}).to_list(100)
        for r in rows:
            r["id"] = gen_id()
            r["product_sku"] = payload.new_sku
        if rows:
            await db.relay_pin_maps.insert_many(rows)
        copied["pin_map"] = len(rows)

    if payload.copy_qc_template:
        tmpl = await db.qc_templates.find_one({"product_sku": sku}, {"_id": 0})
        if tmpl:
            tmpl["id"] = gen_id()
            tmpl["product_sku"] = payload.new_sku
            await db.qc_templates.insert_one(tmpl)
            copied["qc_template"] = len(tmpl.get("items", []))

    if payload.copy_common_mistakes:
        rows = await db.common_mistakes.find({"product_sku": sku}, {"_id": 0}).to_list(500)
        for r in rows:
            r["id"] = gen_id()
            r["product_sku"] = payload.new_sku
        if rows:
            await db.common_mistakes.insert_many(rows)
        copied["common_mistakes"] = len(rows)

    # Revision entries
    note_new = payload.catatan or f"Produk dibuat dari clone SKU: {sku}"
    await db.revision_history.insert_one({
        "id": gen_id(), "product_sku": payload.new_sku, "versi": payload.new_versi,
        "tanggal": now_iso(), "diubah_oleh": user["name"],
        "bagian_berubah": "Clone produk",
        "alasan": note_new,
        "catatan_approval": f"Clone dari {sku}",
    })

    if payload.hold_old:
        await db.products.update_one(
            {"sku": sku}, {"$set": {"status": "Hold", "updated_at": now_iso()}},
        )
        await db.revision_history.insert_one({
            "id": gen_id(), "product_sku": sku, "versi": source.get("versi", "V1"),
            "tanggal": now_iso(), "diubah_oleh": user["name"],
            "bagian_berubah": "Status",
            "alasan": f"Produk ditandai Hold karena dibuat versi baru: {payload.new_sku}",
            "catatan_approval": None,
        })

    new_product_doc = await db.products.find_one({"sku": payload.new_sku}, {"_id": 0})
    return {"product": new_product_doc, "copied": copied}


# ---- Product sub-resources ----
@router.get("/products/{sku}/recipe")
async def get_recipe(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    cables = await db.product_cables.find({"product_sku": sku}, {"_id": 0}).sort("urutan", 1).to_list(1000)
    # join with cable function master
    codes = list({c["cable_code"] for c in cables})
    fns = await db.cable_functions.find({"cable_code": {"$in": codes}}, {"_id": 0}).to_list(1000)
    fn_map = {f["cable_code"]: f for f in fns}
    for c in cables:
        c["cable_function"] = fn_map.get(c["cable_code"])
    return cables


@router.put("/products/{sku}/recipe")
async def replace_recipe(sku: str, items: List[ProductCable], request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.product_cables.delete_many({"product_sku": sku})
    docs = []
    for it in items:
        it.product_sku = sku
        docs.append(it.model_dump())
    if docs:
        await db.product_cables.insert_many(docs)
    await _log_revision(db, sku, user["name"], "Recipe", f"Recipe diperbarui ({len(docs)} kabel)")
    return {"count": len(docs)}


@router.get("/products/{sku}/bundles")
async def get_bundles(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    return await db.product_bundles.find({"product_sku": sku}, {"_id": 0}).sort("urutan", 1).to_list(1000)


@router.put("/products/{sku}/bundles")
async def replace_bundles(sku: str, items: List[ProductBundle], request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.product_bundles.delete_many({"product_sku": sku})
    docs = []
    for it in items:
        it.product_sku = sku
        docs.append(it.model_dump())
    if docs:
        await db.product_bundles.insert_many(docs)
    await _log_revision(db, sku, user["name"], "Bundles", f"Bundle diperbarui ({len(docs)} bundle)")
    return {"count": len(docs)}


@router.get("/products/{sku}/work-instructions/{bundle_code}")
async def get_work_instruction(sku: str, bundle_code: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    wi = await db.work_instructions.find_one({"product_sku": sku, "bundle_code": bundle_code}, {"_id": 0})
    if not wi:
        return {"product_sku": sku, "bundle_code": bundle_code, "steps": []}
    return wi


@router.put("/products/{sku}/work-instructions/{bundle_code}")
async def save_work_instruction(sku: str, bundle_code: str, payload: WorkInstruction, request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    payload.product_sku = sku
    payload.bundle_code = bundle_code
    await db.work_instructions.update_one(
        {"product_sku": sku, "bundle_code": bundle_code},
        {"$set": payload.model_dump()},
        upsert=True,
    )
    await _log_revision(db, sku, user["name"], f"Work Instruction Bundle {bundle_code}", f"{len(payload.steps)} step")
    return payload


@router.get("/products/{sku}/pin-map")
async def get_pin_map(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    return await db.relay_pin_maps.find({"product_sku": sku}, {"_id": 0}).sort("relay_number", 1).to_list(100)


@router.put("/products/{sku}/pin-map")
async def replace_pin_map(sku: str, items: List[RelayPinMap], request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.relay_pin_maps.delete_many({"product_sku": sku})
    docs = []
    for it in items:
        it.product_sku = sku
        docs.append(it.model_dump())
    if docs:
        await db.relay_pin_maps.insert_many(docs)
    await _log_revision(db, sku, user["name"], "Pin Map", f"Pin map diperbarui ({len(docs)} relay)")
    return {"count": len(docs)}


@router.get("/products/{sku}/qc-template")
async def get_qc_template(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    tmpl = await db.qc_templates.find_one({"product_sku": sku}, {"_id": 0})
    if not tmpl:
        return {"product_sku": sku, "items": []}
    return tmpl


@router.put("/products/{sku}/qc-template")
async def save_qc_template(sku: str, payload: QcChecklistTemplate, request: Request, user: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    payload.product_sku = sku
    await db.qc_templates.update_one(
        {"product_sku": sku}, {"$set": payload.model_dump()}, upsert=True,
    )
    await _log_revision(db, sku, user["name"], "QC Template", f"Template QC diperbarui ({len(payload.items)} item)")
    return payload


@router.get("/products/{sku}/common-mistakes")
async def get_common_mistakes(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    return await db.common_mistakes.find({"product_sku": sku}, {"_id": 0}).to_list(1000)


@router.post("/products/{sku}/common-mistakes")
async def add_common_mistake(sku: str, payload: CommonMistake, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    payload.product_sku = sku
    await db.common_mistakes.insert_one(payload.model_dump())
    return payload


@router.delete("/products/{sku}/common-mistakes/{cid}")
async def delete_common_mistake(sku: str, cid: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.common_mistakes.delete_one({"id": cid, "product_sku": sku})
    return {"ok": True}


@router.get("/products/{sku}/revisions")
async def get_revisions(sku: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    return await db.revision_history.find({"product_sku": sku}, {"_id": 0}).sort("tanggal", -1).to_list(1000)


@router.post("/products/{sku}/revisions")
async def add_revision(sku: str, payload: RevisionHistory, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    payload.product_sku = sku
    await db.revision_history.insert_one(payload.model_dump())
    return payload


# ============ CABLE FUNCTIONS ============
@router.get("/cable-functions")
async def list_cable_functions(request: Request, _: dict = Depends(get_current_user), q: Optional[str] = None, kategori: Optional[str] = None):
    db = get_db(request)
    query = {}
    if kategori:
        query["kategori"] = kategori
    if q:
        query["$or"] = [
            {"cable_code": {"$regex": q, "$options": "i"}},
            {"nama_fungsi": {"$regex": q, "$options": "i"}},
            {"ukuran_kabel": {"$regex": q, "$options": "i"}},
        ]
    return await db.cable_functions.find(query, {"_id": 0}).sort("cable_code", 1).to_list(1000)


@router.post("/cable-functions")
async def create_cable_function(payload: CableFunction, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    existing = await db.cable_functions.find_one({"cable_code": payload.cable_code})
    if existing:
        raise HTTPException(status_code=400, detail="Cable code sudah ada")
    await db.cable_functions.insert_one(payload.model_dump())
    return payload


@router.put("/cable-functions/{code}")
async def update_cable_function(code: str, payload: CableFunction, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    upd = payload.model_dump()
    upd.pop("id", None)
    await db.cable_functions.update_one({"cable_code": code}, {"$set": upd})
    return await db.cable_functions.find_one({"cable_code": code}, {"_id": 0})


@router.delete("/cable-functions/{code}")
async def delete_cable_function(code: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.cable_functions.delete_one({"cable_code": code})
    return {"ok": True}


# ============ MACHINE PROGRAMS ============
@router.get("/machine-programs")
async def list_machine_programs(request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    return await db.machine_programs.find({}, {"_id": 0}).sort("nomor_program", 1).to_list(1000)


@router.post("/machine-programs")
async def create_machine_program(payload: MachineProgram, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    existing = await db.machine_programs.find_one({"nomor_program": payload.nomor_program})
    if existing:
        raise HTTPException(status_code=400, detail="Nomor program sudah ada")
    await db.machine_programs.insert_one(payload.model_dump())
    return payload


@router.put("/machine-programs/{number}")
async def update_machine_program(number: str, payload: MachineProgram, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    upd = payload.model_dump()
    upd.pop("id", None)
    await db.machine_programs.update_one({"nomor_program": number}, {"$set": upd})
    return await db.machine_programs.find_one({"nomor_program": number}, {"_id": 0})


@router.delete("/machine-programs/{number}")
async def delete_machine_program(number: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.machine_programs.delete_one({"nomor_program": number})
    return {"ok": True}


# ============ WORK ORDERS ============
async def _gen_wo_number(db) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.work_orders.count_documents({"wo_number": {"$regex": f"^WO-{today}-"}})
    return f"WO-{today}-{count + 1:03d}"


@router.get("/work-orders")
async def list_work_orders(request: Request, _: dict = Depends(get_current_user), status: Optional[str] = None, q: Optional[str] = None):
    db = get_db(request)
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"wo_number": {"$regex": q, "$options": "i"}},
            {"reseller": {"$regex": q, "$options": "i"}},
            {"product_sku": {"$regex": q, "$options": "i"}},
        ]
    return await db.work_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/work-orders")
async def create_work_order(payload: WorkOrderCreateInput, request: Request, user: dict = Depends(require_roles("Admin", "Production"))):
    db = get_db(request)
    prod = await db.products.find_one({"sku": payload.product_sku})
    if not prod:
        raise HTTPException(status_code=400, detail="Produk tidak ditemukan")
    if prod.get("status") not in ("Released", "Trial"):
        raise HTTPException(status_code=400, detail=f"Produk status {prod.get('status')} tidak bisa diproduksi")
    wo_number = await _gen_wo_number(db)
    wo = WorkOrder(
        wo_number=wo_number, product_sku=payload.product_sku, qty=payload.qty,
        reseller=payload.reseller, deadline=payload.deadline, prioritas=payload.prioritas,
        catatan=payload.catatan, status="Menunggu Cutting", created_by=user["name"],
    )
    await db.work_orders.insert_one(wo.model_dump())
    return wo


@router.get("/work-orders/{wo_number}")
async def get_work_order(wo_number: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    wo = await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})
    if not wo:
        raise HTTPException(status_code=404, detail="Work Order tidak ditemukan")
    return wo


@router.put("/work-orders/{wo_number}")
async def update_work_order(wo_number: str, payload: WorkOrderUpdateInput, request: Request, _: dict = Depends(require_roles("Admin", "Production", "QC"))):
    db = get_db(request)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        update["updated_at"] = now_iso()
        await db.work_orders.update_one({"wo_number": wo_number}, {"$set": update})
    return await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})


@router.delete("/work-orders/{wo_number}")
async def delete_work_order(wo_number: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.work_orders.delete_one({"wo_number": wo_number})
    await db.batch_colors.delete_many({"wo_number": wo_number})
    await db.qc_results.delete_many({"wo_number": wo_number})
    return {"ok": True}


@router.get("/work-orders/{wo_number}/cutting-sheet")
async def get_cutting_sheet(wo_number: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    wo = await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})
    if not wo:
        raise HTTPException(status_code=404, detail="WO tidak ditemukan")
    product = await db.products.find_one({"sku": wo["product_sku"]}, {"_id": 0})
    cables = await db.product_cables.find({"product_sku": wo["product_sku"]}, {"_id": 0}).sort("urutan", 1).to_list(1000)
    codes = list({c["cable_code"] for c in cables})
    fns = await db.cable_functions.find({"cable_code": {"$in": codes}}, {"_id": 0}).to_list(1000)
    fn_map = {f["cable_code"]: f for f in fns}
    machines = await db.machine_programs.find({}, {"_id": 0}).to_list(1000)
    # build machine map by cable_code
    mp_by_code = {}
    for m in machines:
        for cc in m.get("cable_codes", []):
            mp_by_code[cc] = m["nomor_program"]
    batches = await db.batch_colors.find({"wo_number": wo_number}, {"_id": 0}).to_list(1000)
    batch_map = {b["cable_code"]: b for b in batches}

    rows = []
    for c in cables:
        fn = fn_map.get(c["cable_code"], {})
        total = c["qty_per_pcs"] * wo["qty"]
        warna_default = fn.get("warna_default")
        warna_aktual = batch_map.get(c["cable_code"], {}).get("warna_aktual") or warna_default
        substitusi = batch_map.get(c["cable_code"]) is not None and batch_map[c["cable_code"]]["warna_aktual"] != warna_default
        rows.append({
            "cable_code": c["cable_code"],
            "nama_fungsi": fn.get("nama_fungsi"),
            "kategori": fn.get("kategori"),
            "warna_wajib": fn.get("warna_wajib", False),
            "ukuran_kabel": fn.get("ukuran_kabel"),
            "panjang_cm": fn.get("panjang_cm"),
            "qty_per_pcs": c["qty_per_pcs"],
            "total_qty": total,
            "warna_default": warna_default,
            "warna_aktual": warna_aktual,
            "substitusi": bool(substitusi),
            "alasan_substitusi": batch_map.get(c["cable_code"], {}).get("alasan"),
            "nomor_program": mp_by_code.get(c["cable_code"]),
            "bundle_code": c["bundle_code"],
        })
    return {"wo": wo, "product": product, "rows": rows}


@router.get("/work-orders/{wo_number}/batch-colors")
async def list_batch_colors(wo_number: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    return await db.batch_colors.find({"wo_number": wo_number}, {"_id": 0}).to_list(1000)


@router.post("/work-orders/{wo_number}/batch-colors")
async def set_batch_color(wo_number: str, payload: BatchColorInput, request: Request, user: dict = Depends(require_roles("Admin", "Production"))):
    db = get_db(request)
    fn = await db.cable_functions.find_one({"cable_code": payload.cable_code}, {"_id": 0})
    if not fn:
        raise HTTPException(status_code=400, detail="Cable code tidak ditemukan")
    warning = None
    if fn.get("warna_wajib") and fn.get("warna_default") and payload.warna_aktual.lower() != fn["warna_default"].lower():
        if not payload.alasan:
            raise HTTPException(status_code=400, detail=f"Warna {payload.cable_code} ({fn['warna_default']}) wajib. Substitusi membutuhkan alasan.")
        warning = f"Substitusi warna pada kabel wajib ({fn['kategori']})."
    bc = BatchColor(
        wo_number=wo_number, cable_code=payload.cable_code,
        warna_default=fn.get("warna_default"), warna_aktual=payload.warna_aktual,
        alasan=payload.alasan, input_by=user["name"],
    )
    await db.batch_colors.update_one(
        {"wo_number": wo_number, "cable_code": payload.cable_code},
        {"$set": bc.model_dump()}, upsert=True,
    )
    return {"batch": bc, "warning": warning}


@router.post("/work-orders/{wo_number}/mark-cutting-done")
async def mark_cutting_done(wo_number: str, request: Request, user: dict = Depends(require_roles("Admin", "Production"))):
    db = get_db(request)
    await db.work_orders.update_one(
        {"wo_number": wo_number},
        {"$set": {"status": "Cutting Selesai", "operator_cutting": user["name"], "updated_at": now_iso()}},
    )
    return await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})


@router.get("/work-orders/{wo_number}/bundles")
async def get_wo_bundles(wo_number: str, request: Request, _: dict = Depends(get_current_user)):
    """Returns all bundles with cables and actual colors for bundle labels."""
    db = get_db(request)
    wo = await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})
    if not wo:
        raise HTTPException(status_code=404, detail="WO tidak ditemukan")
    sku = wo["product_sku"]
    bundles = await db.product_bundles.find({"product_sku": sku}, {"_id": 0}).sort("urutan", 1).to_list(100)
    cables = await db.product_cables.find({"product_sku": sku}, {"_id": 0}).sort("urutan", 1).to_list(1000)
    codes = list({c["cable_code"] for c in cables})
    fns = await db.cable_functions.find({"cable_code": {"$in": codes}}, {"_id": 0}).to_list(1000)
    fn_map = {f["cable_code"]: f for f in fns}
    batches = await db.batch_colors.find({"wo_number": wo_number}, {"_id": 0}).to_list(1000)
    batch_map = {b["cable_code"]: b for b in batches}

    cables_by_bundle = {}
    for c in cables:
        fn = fn_map.get(c["cable_code"], {})
        warna = batch_map.get(c["cable_code"], {}).get("warna_aktual") or fn.get("warna_default")
        cables_by_bundle.setdefault(c["bundle_code"], []).append({
            "cable_code": c["cable_code"],
            "ukuran_kabel": fn.get("ukuran_kabel"),
            "panjang_cm": fn.get("panjang_cm"),
            "warna": warna,
            "qty_per_pcs": c["qty_per_pcs"],
            "total_qty": c["qty_per_pcs"] * wo["qty"],
        })

    for b in bundles:
        b["cables"] = cables_by_bundle.get(b["bundle_code"], [])
    return {"wo": wo, "bundles": bundles}


@router.get("/work-orders/{wo_number}/bundles/{bundle_code}")
async def get_wo_bundle_detail(wo_number: str, bundle_code: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    wo = await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})
    if not wo:
        raise HTTPException(status_code=404, detail="WO tidak ditemukan")
    sku = wo["product_sku"]
    product = await db.products.find_one({"sku": sku}, {"_id": 0})
    bundle = await db.product_bundles.find_one({"product_sku": sku, "bundle_code": bundle_code}, {"_id": 0})
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle tidak ditemukan")
    cables = await db.product_cables.find({"product_sku": sku, "bundle_code": bundle_code}, {"_id": 0}).sort("urutan", 1).to_list(100)
    codes = [c["cable_code"] for c in cables]
    fns = await db.cable_functions.find({"cable_code": {"$in": codes}}, {"_id": 0}).to_list(1000)
    fn_map = {f["cable_code"]: f for f in fns}
    batches = await db.batch_colors.find({"wo_number": wo_number, "cable_code": {"$in": codes}}, {"_id": 0}).to_list(1000)
    batch_map = {b["cable_code"]: b for b in batches}

    cable_rows = []
    for c in cables:
        fn = fn_map.get(c["cable_code"], {})
        warna = batch_map.get(c["cable_code"], {}).get("warna_aktual") or fn.get("warna_default")
        cable_rows.append({
            **c,
            "nama_fungsi": fn.get("nama_fungsi"),
            "ukuran_kabel": fn.get("ukuran_kabel"),
            "panjang_cm": fn.get("panjang_cm"),
            "warna": warna,
            "warna_default": fn.get("warna_default"),
            "total_qty": c["qty_per_pcs"] * wo["qty"],
            "substitusi": batch_map.get(c["cable_code"]) is not None and batch_map[c["cable_code"]]["warna_aktual"] != fn.get("warna_default"),
        })
    wi = await db.work_instructions.find_one({"product_sku": sku, "bundle_code": bundle_code}, {"_id": 0})
    mistakes = await db.common_mistakes.find({"product_sku": sku, "bundle_code": bundle_code}, {"_id": 0}).to_list(100)

    # bundle order navigation
    all_bundles = await db.product_bundles.find({"product_sku": sku}, {"_id": 0, "bundle_code": 1, "urutan": 1}).sort("urutan", 1).to_list(100)
    codes_order = [b["bundle_code"] for b in all_bundles]
    idx = codes_order.index(bundle_code) if bundle_code in codes_order else -1
    prev_b = codes_order[idx - 1] if idx > 0 else None
    next_b = codes_order[idx + 1] if 0 <= idx < len(codes_order) - 1 else None

    return {
        "wo": wo,
        "product": product,
        "bundle": bundle,
        "cables": cable_rows,
        "work_instruction": wi or {"steps": []},
        "common_mistakes": mistakes,
        "prev_bundle": prev_b,
        "next_bundle": next_b,
    }


# ============ QC ============
@router.get("/work-orders/{wo_number}/qc")
async def get_qc(wo_number: str, request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)
    wo = await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})
    if not wo:
        raise HTTPException(status_code=404, detail="WO tidak ditemukan")
    tmpl = await db.qc_templates.find_one({"product_sku": wo["product_sku"]}, {"_id": 0})
    result = await db.qc_results.find_one({"wo_number": wo_number}, {"_id": 0})
    return {"template": tmpl or {"items": []}, "result": result, "wo": wo}


@router.post("/work-orders/{wo_number}/qc")
async def submit_qc(wo_number: str, payload: QcResultInput, request: Request, user: dict = Depends(require_roles("Admin", "QC", "Production"))):
    db = get_db(request)
    wo = await db.work_orders.find_one({"wo_number": wo_number}, {"_id": 0})
    if not wo:
        raise HTTPException(status_code=404, detail="WO tidak ditemukan")
    # Determine overall
    overall = "Pass"
    has_pending = False
    for it in payload.items:
        if it.required and it.pass_fail == "Fail":
            overall = "Fail"
        if it.required and it.pass_fail == "NA":
            has_pending = True
    if overall != "Fail" and has_pending:
        overall = "Pending"
    result = QcResult(
        wo_number=wo_number, product_sku=wo["product_sku"], qc_person=user["name"],
        items=payload.items, overall=overall, catatan_rework=payload.catatan_rework,
    )
    await db.qc_results.update_one(
        {"wo_number": wo_number}, {"$set": result.model_dump()}, upsert=True,
    )
    # Update WO status
    new_status = wo["status"]
    if overall == "Pass":
        new_status = "QC Pass"
    elif overall == "Fail":
        new_status = "Rework"
    else:
        new_status = "QC Berjalan"
    await db.work_orders.update_one(
        {"wo_number": wo_number},
        {"$set": {"status": new_status, "qc_person": user["name"], "updated_at": now_iso()}},
    )
    return {"result": result, "wo_status": new_status}


# ============ TRAINING MATRIX ============
@router.get("/training-matrix")
async def list_training(request: Request, _: dict = Depends(get_current_user), product_sku: Optional[str] = None, qualified_only: bool = False):
    db = get_db(request)
    query = {}
    if product_sku:
        query["product_sku"] = product_sku
    if qualified_only:
        query["skill_level"] = {"$in": ["Bisa mandiri", "Trainer"]}
    return await db.training_matrix.find(query, {"_id": 0}).to_list(2000)


@router.post("/training-matrix")
async def create_training(payload: TrainingMatrix, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.training_matrix.insert_one(payload.model_dump())
    return payload


@router.put("/training-matrix/{tid}")
async def update_training(tid: str, payload: TrainingMatrix, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    upd = payload.model_dump()
    upd.pop("id", None)
    await db.training_matrix.update_one({"id": tid}, {"$set": upd})
    return await db.training_matrix.find_one({"id": tid}, {"_id": 0})


@router.delete("/training-matrix/{tid}")
async def delete_training(tid: str, request: Request, _: dict = Depends(require_roles("Admin"))):
    db = get_db(request)
    await db.training_matrix.delete_one({"id": tid})
    return {"ok": True}


# ============ DASHBOARD ============
@router.get("/dashboard/stats")
async def dashboard_stats(request: Request, _: dict = Depends(get_current_user)):
    db = get_db(request)

    async def cnt(q):
        return await db.work_orders.count_documents(q)

    active_statuses = [
        "Menunggu Cutting", "Cutting Berjalan", "Cutting Selesai",
        "Produksi Berjalan", "Menunggu QC", "QC Berjalan", "Rework", "Packing",
    ]
    stats = {
        "active": await cnt({"status": {"$in": active_statuses}}),
        "menunggu_cutting": await cnt({"status": "Menunggu Cutting"}),
        "produksi": await cnt({"status": {"$in": ["Cutting Berjalan", "Cutting Selesai", "Produksi Berjalan"]}}),
        "menunggu_qc": await cnt({"status": {"$in": ["Menunggu QC", "QC Berjalan"]}}),
        "qc_pass": await cnt({"status": "QC Pass"}),
        "selesai": await cnt({"status": "Done"}),
        "rework": await cnt({"status": "Rework"}),
        "produk_draft": await db.products.count_documents({"status": "Draft"}),
        "produk_trial": await db.products.count_documents({"status": "Trial"}),
        "produk_released": await db.products.count_documents({"status": "Released"}),
    }
    recent = await db.work_orders.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    stats["recent"] = recent
    return stats
