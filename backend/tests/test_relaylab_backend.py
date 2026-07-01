"""RelayLab Production OS — Backend integration tests.

Covers auth (session cookie), products, recipe, bundles, pin map,
QC template, common mistakes, cable functions, machine programs,
work orders (create, cutting sheet, batch colors, mark cutting done,
bundles, QC submit), users management, dashboard, and role enforcement.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wo-manager.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("arif", "admin123")
PROD = ("redi", "prod123")
QC = ("leni", "qc123")
SKU = "RFL-AOD-H11-V1"


# ---------- fixtures ----------
def _sess(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": creds[0], "password": creds[1]}, timeout=30)
    assert r.status_code == 200, f"login failed for {creds[0]}: {r.status_code} {r.text}"
    assert "rl_session" in s.cookies, f"no rl_session cookie set for {creds[0]}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _sess(ADMIN)


@pytest.fixture(scope="module")
def prod():
    return _sess(PROD)


@pytest.fixture(scope="module")
def qc():
    return _sess(QC)


# ---------- AUTH ----------
class TestAuth:
    def test_login_admin_sets_cookie_and_me(self):
        s = _sess(ADMIN)
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "arif"
        assert data["role"] == "Admin"

    def test_login_qc_and_logout_clears(self):
        s = _sess(QC)
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["role"] == "QC"
        # logout
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": "arif", "password": "wrong"}, timeout=30)
        assert r.status_code == 401
        assert r.json().get("detail") == "Username atau password salah"

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_change_password_wrong_current(self, admin):
        r = admin.post(f"{API}/auth/change-password", json={"current_password": "WRONG", "new_password": "newpass123"})
        assert r.status_code == 400

    def test_change_password_correct_then_revert(self):
        # change arif pwd, login with new, revert
        s = _sess(ADMIN)
        r = s.post(f"{API}/auth/change-password", json={"current_password": "admin123", "new_password": "admin124"})
        assert r.status_code == 200
        # login with new
        s2 = requests.Session()
        r = s2.post(f"{API}/auth/login", json={"username": "arif", "password": "admin124"})
        assert r.status_code == 200
        # revert
        r = s2.post(f"{API}/auth/change-password", json={"current_password": "admin124", "new_password": "admin123"})
        assert r.status_code == 200


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_stats(self, admin):
        r = admin.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for key in ["active", "menunggu_cutting", "produksi", "menunggu_qc", "qc_pass", "rework",
                    "produk_draft", "produk_trial", "produk_released", "recent"]:
            assert key in d
        assert isinstance(d["recent"], list)


# ---------- PRODUCTS / RECIPE ----------
class TestProducts:
    def test_list_includes_seed(self, admin):
        r = admin.get(f"{API}/products")
        assert r.status_code == 200
        skus = [p["sku"] for p in r.json()]
        assert SKU in skus
        seeded = next(p for p in r.json() if p["sku"] == SKU)
        assert seeded["status"] == "Released"

    def test_recipe_17_cables_joined(self, admin):
        r = admin.get(f"{API}/products/{SKU}/recipe")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 17, f"expected 17 cables, got {len(rows)}"
        for row in rows:
            assert "cable_function" in row
            assert row["cable_function"] is not None, f"cable_function missing for {row['cable_code']}"

    def test_bundles_10(self, admin):
        r = admin.get(f"{API}/products/{SKU}/bundles")
        assert r.status_code == 200
        bundles = r.json()
        assert len(bundles) == 10
        codes = sorted(b["bundle_code"] for b in bundles)
        assert codes == list("ABCDEFGHIJ")

    def test_pin_map_3(self, admin):
        r = admin.get(f"{API}/products/{SKU}/pin-map")
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_qc_template_10(self, admin):
        r = admin.get(f"{API}/products/{SKU}/qc-template")
        assert r.status_code == 200
        tmpl = r.json()
        assert len(tmpl.get("items", [])) == 10

    def test_common_mistakes(self, admin):
        r = admin.get(f"{API}/products/{SKU}/common-mistakes")
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ---------- CABLE FUNCTIONS + MACHINE PROGRAMS ----------
class TestMasterData:
    def test_cable_functions_17(self, admin):
        r = admin.get(f"{API}/cable-functions")
        assert r.status_code == 200
        assert len(r.json()) == 17

    def test_cable_functions_filter_q_dev(self, admin):
        r = admin.get(f"{API}/cable-functions", params={"q": "DEV"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for c in data:
            assert "DEV" in c["cable_code"].upper() or "DEV" in (c.get("nama_fungsi") or "").upper()

    def test_cable_functions_filter_kategori_power(self, admin):
        r = admin.get(f"{API}/cable-functions", params={"kategori": "Power"})
        assert r.status_code == 200
        codes = [c["cable_code"] for c in r.json()]
        assert "BATT-IN" in codes

    def test_machine_programs_14(self, admin):
        r = admin.get(f"{API}/machine-programs")
        assert r.status_code == 200
        progs = r.json()
        assert len(progs) == 14
        # Each program has cable_codes list
        for p in progs:
            assert "cable_codes" in p
            assert isinstance(p["cable_codes"], list)


# ---------- WORK ORDERS full flow ----------
class TestWorkOrderFlow:
    wo_number = None  # class-level cache

    def test_create_wo_as_production(self, prod):
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": SKU, "qty": 100, "reseller": "TEST_Toko",
            "prioritas": "Normal", "catatan": "TEST run"
        })
        assert r.status_code == 200, r.text
        wo = r.json()
        assert wo["wo_number"].startswith("WO-")
        assert wo["status"] == "Menunggu Cutting"
        assert wo["qty"] == 100
        assert wo["reseller"] == "TEST_Toko"
        # format YYYYMMDD- nnn
        parts = wo["wo_number"].split("-")
        assert len(parts) == 3 and len(parts[1]) == 8 and len(parts[2]) == 3
        TestWorkOrderFlow.wo_number = wo["wo_number"]

    def test_cutting_sheet_totals_and_defaults(self, prod):
        wo = TestWorkOrderFlow.wo_number
        assert wo
        r = prod.get(f"{API}/work-orders/{wo}/cutting-sheet")
        assert r.status_code == 200
        data = r.json()
        rows = data["rows"]
        assert len(rows) == 17
        for row in rows:
            assert row["total_qty"] == row["qty_per_pcs"] * 100
            # default color comes from cable_function (most should have one)
        # at least some rows should have nomor_program
        progs = [r["nomor_program"] for r in rows if r.get("nomor_program")]
        assert len(progs) >= 1

    def test_batch_color_non_mandatory(self, prod):
        wo = TestWorkOrderFlow.wo_number
        r = prod.post(f"{API}/work-orders/{wo}/batch-colors", json={
            "cable_code": "DEV-OUT-S", "warna_aktual": "Coklat"
        })
        assert r.status_code == 200, r.text
        # cutting sheet should reflect substitusi
        cs = prod.get(f"{API}/work-orders/{wo}/cutting-sheet").json()
        row = next(rr for rr in cs["rows"] if rr["cable_code"] == "DEV-OUT-S")
        assert row["substitusi"] is True
        assert row["warna_aktual"] == "Coklat"

    def test_batch_color_mandatory_requires_alasan(self, prod):
        wo = TestWorkOrderFlow.wo_number
        r = prod.post(f"{API}/work-orders/{wo}/batch-colors", json={
            "cable_code": "BATT-IN", "warna_aktual": "Biru"
        })
        assert r.status_code == 400, f"expected 400 without alasan, got {r.status_code}: {r.text}"

    def test_batch_color_mandatory_with_alasan(self, prod):
        wo = TestWorkOrderFlow.wo_number
        r = prod.post(f"{API}/work-orders/{wo}/batch-colors", json={
            "cable_code": "BATT-IN", "warna_aktual": "Biru", "alasan": "stok kosong"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("warning")

    def test_mark_cutting_done(self, prod):
        wo = TestWorkOrderFlow.wo_number
        r = prod.post(f"{API}/work-orders/{wo}/mark-cutting-done")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "Cutting Selesai"
        assert d["operator_cutting"] == "Redi"

    def test_wo_bundles_10(self, prod):
        wo = TestWorkOrderFlow.wo_number
        r = prod.get(f"{API}/work-orders/{wo}/bundles")
        assert r.status_code == 200
        d = r.json()
        assert len(d["bundles"]) == 10
        for b in d["bundles"]:
            for c in b["cables"]:
                assert c.get("warna")

    def test_wo_bundle_A_detail(self, prod):
        wo = TestWorkOrderFlow.wo_number
        r = prod.get(f"{API}/work-orders/{wo}/bundles/A")
        assert r.status_code == 200
        d = r.json()
        assert d["bundle"]["bundle_code"] == "A"
        cable_codes = [c["cable_code"] for c in d["cables"]]
        assert "DEV-OUT-S" in cable_codes and "DEV-OUT-L" in cable_codes
        assert len(d["work_instruction"]["steps"]) >= 5
        assert d["prev_bundle"] is None
        assert d["next_bundle"] == "B"

    def test_qc_template_via_wo(self, qc):
        wo = TestWorkOrderFlow.wo_number
        r = qc.get(f"{API}/work-orders/{wo}/qc")
        assert r.status_code == 200
        d = r.json()
        assert len(d["template"]["items"]) == 10

    def test_qc_submit_fail_then_pass(self, qc):
        wo = TestWorkOrderFlow.wo_number
        # fetch template
        tmpl = qc.get(f"{API}/work-orders/{wo}/qc").json()["template"]
        items_fail = []
        for i, it in enumerate(tmpl["items"]):
            items_fail.append({
                "item_id": it["id"], "nama": it["nama"], "required": it.get("required", True),
                "pass_fail": "Fail" if i == 0 else "Pass",
            })
        r = qc.post(f"{API}/work-orders/{wo}/qc", json={"items": items_fail, "catatan_rework": "test fail"})
        assert r.status_code == 200
        d = r.json()
        assert d["result"]["overall"] == "Fail"
        assert d["wo_status"] == "Rework"
        # now submit all pass
        items_pass = [{
            "item_id": it["id"], "nama": it["nama"], "required": it.get("required", True),
            "pass_fail": "Pass"
        } for it in tmpl["items"]]
        r = qc.post(f"{API}/work-orders/{wo}/qc", json={"items": items_pass})
        assert r.status_code == 200
        d = r.json()
        assert d["result"]["overall"] == "Pass"
        assert d["wo_status"] == "QC Pass"

    def test_cleanup_delete_wo(self, admin):
        wo = TestWorkOrderFlow.wo_number
        if wo:
            r = admin.delete(f"{API}/work-orders/{wo}")
            assert r.status_code == 200


# ---------- ROLE ENFORCEMENT ----------
class TestRoles:
    def test_qc_cannot_create_product(self, qc):
        r = qc.post(f"{API}/products", json={
            "sku": "TEST_ROLE", "nama_produk": "Test", "status": "Draft"
        })
        assert r.status_code == 403

    def test_qc_cannot_create_wo(self, qc):
        r = qc.post(f"{API}/work-orders", json={"product_sku": SKU, "qty": 1})
        assert r.status_code == 403

    def test_qc_cannot_list_users(self, qc):
        r = qc.get(f"{API}/users")
        assert r.status_code == 403

    def test_admin_can_create_user(self, admin):
        payload = {
            "name": "TEST User", "username": "TEST_userx",
            "email": "t@t.com", "password": "pw1234", "role": "Production", "active": True
        }
        # cleanup if exists
        r = admin.post(f"{API}/users", json=payload)
        # could be 400 if exists from prior run; handle either
        if r.status_code == 400:
            # find and delete
            users = admin.get(f"{API}/users").json()
            existing = next((u for u in users if u["username"] == "TEST_userx"), None)
            if existing:
                admin.delete(f"{API}/users/{existing['id']}")
            r = admin.post(f"{API}/users", json=payload)
        assert r.status_code == 200, r.text
        new_user = r.json()
        assert new_user["username"] == "TEST_userx"
        # cleanup
        admin.delete(f"{API}/users/{new_user['id']}")



# ---------- P1: REVISION AUTO-LOG ----------
class TestAutoRevisionLog:
    """Verify _log_revision triggers on PUT recipe/bundles/work-instructions/pin-map/qc-template."""

    def _count(self, admin):
        r = admin.get(f"{API}/products/{SKU}/revisions")
        assert r.status_code == 200
        return r.json()

    def test_put_recipe_logs_revision(self, admin):
        before = self._count(admin)
        rec = admin.get(f"{API}/products/{SKU}/recipe").json()
        payload = [{k: v for k, v in r.items() if k != "cable_function"} for r in rec]
        r = admin.put(f"{API}/products/{SKU}/recipe", json=payload)
        assert r.status_code == 200, r.text
        after = self._count(admin)
        assert len(after) == len(before) + 1
        latest = after[0]
        assert "Recipe" in latest["bagian_berubah"]
        assert latest["diubah_oleh"] == "Arif"
        # Released product => catatan_approval set
        assert latest.get("catatan_approval") == "Produk Released — disarankan buat versi baru."

    def test_put_bundles_logs_revision(self, admin):
        before = self._count(admin)
        bundles = admin.get(f"{API}/products/{SKU}/bundles").json()
        r = admin.put(f"{API}/products/{SKU}/bundles", json=bundles)
        assert r.status_code == 200, r.text
        after = self._count(admin)
        assert len(after) == len(before) + 1
        assert "Bundles" in after[0]["bagian_berubah"]
        assert after[0]["diubah_oleh"] == "Arif"

    def test_put_work_instruction_logs_revision(self, admin):
        before = self._count(admin)
        wi = admin.get(f"{API}/products/{SKU}/work-instructions/A").json()
        r = admin.put(f"{API}/products/{SKU}/work-instructions/A", json=wi)
        assert r.status_code == 200, r.text
        after = self._count(admin)
        assert len(after) == len(before) + 1
        assert "Work Instruction" in after[0]["bagian_berubah"]
        assert "A" in after[0]["bagian_berubah"]

    def test_put_pin_map_logs_revision(self, admin):
        before = self._count(admin)
        pm = admin.get(f"{API}/products/{SKU}/pin-map").json()
        r = admin.put(f"{API}/products/{SKU}/pin-map", json=pm)
        assert r.status_code == 200, r.text
        after = self._count(admin)
        assert len(after) == len(before) + 1
        assert "Pin Map" in after[0]["bagian_berubah"]

    def test_put_qc_template_logs_revision(self, admin):
        before = self._count(admin)
        tmpl = admin.get(f"{API}/products/{SKU}/qc-template").json()
        r = admin.put(f"{API}/products/{SKU}/qc-template", json=tmpl)
        assert r.status_code == 200, r.text
        after = self._count(admin)
        assert len(after) == len(before) + 1
        assert "QC Template" in after[0]["bagian_berubah"]


# ---------- P1: TRAINING MATRIX FILTER ----------
class TestTrainingFilter:
    def test_training_qualified_only_for_sku(self, admin):
        r = admin.get(f"{API}/training-matrix", params={"product_sku": SKU, "qualified_only": "true"})
        assert r.status_code == 200, r.text
        rows = r.json()
        # Per problem statement: expect Redi, Windu, Dede, Leni, Arif (Fauzi excluded)
        for row in rows:
            assert row["product_sku"] == SKU
            assert row["skill_level"] in ["Bisa mandiri", "Trainer"]
        names = sorted({r["nama_karyawan"] for r in rows})
        # Fauzi must be excluded
        assert "Fauzi" not in names, f"Fauzi should NOT be in qualified list: {names}"
        # 5 qualified expected
        assert len(rows) == 5, f"expected 5 qualified operators, got {len(rows)}: {names}"
        for expected in ["Arif", "Redi", "Windu", "Dede", "Leni"]:
            assert expected in names, f"missing {expected} in {names}"

    def test_training_no_filter_includes_fauzi(self, admin):
        r = admin.get(f"{API}/training-matrix", params={"product_sku": SKU})
        assert r.status_code == 200
        names = {row["nama_karyawan"] for row in r.json()}
        assert "Fauzi" in names


# ---------- P2A: PRODUCT VERSIONING & CLONE ----------
SRC_SKU = "RFL-AOD-H11-V1"


def _delete_product_cascade(admin, sku):
    """Helper: hard-delete a product and its sub-collections via mongo-shell-like API."""
    # Backend has no DELETE /products/{sku} — use direct mongo via a small admin endpoint?
    # Fallback: rely on uniqueness reset by skipping if not present.
    pass


def _cleanup_versions(admin):
    """Remove any test-created V2/V3 products and reset V1 version_group."""
    import pymongo, os
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db_name = os.environ.get("DB_NAME", "test_database")
    db = cli[db_name]
    test_skus = ["RFL-AOD-H11-V2", "RFL-AOD-H11-V3", "RFL-AOD-H11-V4", "RFL-STD-H11-V1"]
    for sku in test_skus:
        db.products.delete_many({"sku": sku})
        db.product_cables.delete_many({"product_sku": sku})
        db.product_bundles.delete_many({"product_sku": sku})
        db.work_instructions.delete_many({"product_sku": sku})
        db.relay_pin_maps.delete_many({"product_sku": sku})
        db.qc_templates.delete_many({"product_sku": sku})
        db.common_mistakes.delete_many({"product_sku": sku})
        db.revision_history.delete_many({"product_sku": sku})
    # Reset V1 source
    db.products.update_one({"sku": SRC_SKU}, {"$unset": {"version_group": "", "parent_sku": "", "source_sku": ""}, "$set": {"status": "Released"}})
    # Remove revision rows about clone/hold on V1
    db.revision_history.delete_many({"product_sku": SRC_SKU, "bagian_berubah": {"$in": ["Status"]}, "alasan": {"$regex": "versi baru"}})


@pytest.fixture(scope="class", autouse=True)
def cleanup_versions_around(request):
    """Run cleanup before AND after the P2A class."""
    if request.cls.__name__ in ("TestP2AClone", "TestP2BCompare"):
        # Need an admin session for cleanup
        s = _sess(ADMIN)
        _cleanup_versions(s)
        yield
        _cleanup_versions(s)
    else:
        yield


class TestP2AClone:
    NEW_SKU = "RFL-AOD-H11-V2"

    def test_suggest_version_admin_v2(self, admin):
        r = admin.get(f"{API}/products/{SRC_SKU}/suggest-version")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["new_sku"] == "RFL-AOD-H11-V2"
        assert d["new_versi"] == "V2"
        assert d["new_nama_produk"]

    def test_suggest_version_qc_403(self, qc):
        r = qc.get(f"{API}/products/{SRC_SKU}/suggest-version")
        assert r.status_code == 403

    def test_suggest_version_prod_403(self, prod):
        r = prod.get(f"{API}/products/{SRC_SKU}/suggest-version")
        assert r.status_code == 403

    def test_clone_source_not_found(self, admin):
        r = admin.post(f"{API}/products/NONEXISTENT/clone", json={
            "new_sku": "X-V2", "new_nama_produk": "x"
        })
        assert r.status_code == 404

    def test_clone_role_prod_403(self, prod):
        r = prod.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": "RFL-AOD-H11-V2", "new_nama_produk": "x"
        })
        assert r.status_code == 403

    def test_clone_full_copy_v2(self, admin):
        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": "RFL-AOD-H11-V2",
            "new_nama_produk": "Foglamp AOD V2",
            "new_versi": "V2",
            "new_status": "Draft",
            "copy_recipe": True, "copy_bundles": True,
            "copy_work_instructions": True, "copy_pin_map": True,
            "copy_qc_template": True, "copy_common_mistakes": True,
            "hold_old": False,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        p = d["product"]
        assert p["sku"] == "RFL-AOD-H11-V2"
        assert p["parent_sku"] == SRC_SKU
        assert p["source_sku"] == SRC_SKU
        assert p["version_group"] == SRC_SKU
        c = d["copied"]
        assert c.get("recipe") == 17
        assert c.get("bundles") == 10
        assert c.get("work_instructions") == 10
        assert c.get("pin_map") == 3
        assert c.get("qc_template") == 10
        assert c.get("common_mistakes") >= 1
        # source now has version_group too
        src = admin.get(f"{API}/products/{SRC_SKU}").json()
        assert src["version_group"] == SRC_SKU

    def test_cloned_subresources_persisted(self, admin):
        new = "RFL-AOD-H11-V2"
        assert admin.get(f"{API}/products/{new}/recipe").status_code == 200
        rec = admin.get(f"{API}/products/{new}/recipe").json()
        assert len(rec) == 17
        # ids must differ from source
        src_rec = admin.get(f"{API}/products/{SRC_SKU}/recipe").json()
        assert set(r["id"] for r in rec).isdisjoint(set(r["id"] for r in src_rec))

        assert len(admin.get(f"{API}/products/{new}/bundles").json()) == 10
        assert len(admin.get(f"{API}/products/{new}/pin-map").json()) == 3
        tmpl = admin.get(f"{API}/products/{new}/qc-template").json()
        assert len(tmpl["items"]) == 10
        assert len(admin.get(f"{API}/products/{new}/common-mistakes").json()) >= 1

    def test_revision_log_on_new(self, admin):
        revs = admin.get(f"{API}/products/RFL-AOD-H11-V2/revisions").json()
        assert len(revs) == 1
        r0 = revs[0]
        assert r0["bagian_berubah"] == "Clone produk"
        assert r0["diubah_oleh"] == "Arif"
        assert r0.get("catatan_approval") == f"Clone dari {SRC_SKU}"

    def test_duplicate_sku_rejected(self, admin):
        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": "RFL-AOD-H11-V2", "new_nama_produk": "dup"
        })
        assert r.status_code == 400
        assert "sudah dipakai" in r.json().get("detail", "")

    def test_suggest_increments_to_v3(self, admin):
        r = admin.get(f"{API}/products/{SRC_SKU}/suggest-version").json()
        assert r["new_sku"] == "RFL-AOD-H11-V3"

    def test_clone_hold_old_v3(self, admin):
        # create V3 with hold_old=true
        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": "RFL-AOD-H11-V3", "new_nama_produk": "V3",
            "new_versi": "V3", "new_status": "Draft",
            "copy_recipe": True, "copy_bundles": True,
            "copy_work_instructions": True, "copy_pin_map": True,
            "copy_qc_template": True, "copy_common_mistakes": True,
            "hold_old": True,
        })
        assert r.status_code == 200, r.text
        src = admin.get(f"{API}/products/{SRC_SKU}").json()
        assert src["status"] == "Hold"
        # find revision on source about hold
        revs = admin.get(f"{API}/products/{SRC_SKU}/revisions").json()
        hold_rev = [x for x in revs if "Hold" in (x.get("alasan") or "")]
        assert hold_rev, f"missing Hold revision: {revs}"
        assert "RFL-AOD-H11-V3" in hold_rev[0]["alasan"]

    def test_clone_selective_copy(self, admin):
        # First, restore V1 to Released so it can be cloned again from a clean source
        # Use STD SKU (different prefix) to test fallback -V2 path
        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": "RFL-STD-H11-V1",
            "new_nama_produk": "Selective",
            "new_versi": "V1",
            "new_status": "Draft",
            "copy_recipe": True, "copy_bundles": True,
            "copy_work_instructions": False, "copy_pin_map": False,
            "copy_qc_template": False, "copy_common_mistakes": False,
            "hold_old": False,
        })
        assert r.status_code == 200, r.text
        d = r.json()["copied"]
        assert d.get("recipe") == 17
        assert d.get("bundles") == 10
        assert "work_instructions" not in d
        assert "pin_map" not in d
        assert "qc_template" not in d
        assert "common_mistakes" not in d
        # Verify persistence
        assert len(admin.get(f"{API}/products/RFL-STD-H11-V1/pin-map").json()) == 0
        assert len(admin.get(f"{API}/products/RFL-STD-H11-V1/common-mistakes").json()) == 0
        tmpl = admin.get(f"{API}/products/RFL-STD-H11-V1/qc-template").json()
        assert len(tmpl["items"]) == 0


# ============ P2B: Product Compare / Diff ============
class TestP2BCompare:
    NEW = "RFL-AOD-H11-V4"

    @pytest.fixture(scope="class")
    def setup_v2_with_diff(self, admin):
        # Clone V1 -> V2 first
        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": self.NEW, "new_nama_produk": "Foglamp AOD V4 (Compare Test)",
            "new_versi": "V4", "new_status": "Draft",
            "copy_recipe": True, "copy_bundles": True,
            "copy_work_instructions": True, "copy_pin_map": True,
            "copy_qc_template": True, "copy_common_mistakes": True,
            "hold_old": False,
        })
        assert r.status_code == 200, r.text

        # Fetch V1 recipe, drop GND-OUT, change qty/catatan of another, then PUT to V2.
        rec = admin.get(f"{API}/products/{SRC_SKU}/recipe").json()
        # strip non-Cable fields (cable_function is a join)
        new_rec = []
        target_changed_code = None
        for c in rec:
            if c["cable_code"] == "GND-OUT":
                continue
            c2 = {k: v for k, v in c.items() if k != "cable_function"}
            if target_changed_code is None and c["cable_code"] != "GND-OUT":
                c2["qty_per_pcs"] = (c.get("qty_per_pcs", 1) or 1) + 5
                c2["catatan_proses"] = (c.get("catatan_proses") or "") + " [CHANGED]"
                target_changed_code = c["cable_code"]
            new_rec.append(c2)
        # PUT
        r = admin.put(f"{API}/products/{self.NEW}/recipe", json=new_rec)
        assert r.status_code == 200, r.text
        return {"changed_code": target_changed_code, "removed_code": "GND-OUT"}

    def test_compare_endpoint_structure(self, admin, setup_v2_with_diff):
        r = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("current", "source", "summary", "recipe", "bundles",
                  "work_instructions", "pin_map", "qc_template", "common_mistakes"):
            assert k in d, f"missing key {k}"
        assert d["current"]["sku"] == self.NEW
        assert d["source"]["sku"] == SRC_SKU
        for sec in ("recipe", "bundles", "work_instructions", "pin_map", "qc_template", "common_mistakes"):
            assert sec in d["summary"]
            for s in ("added", "removed", "changed", "unchanged"):
                assert s in d["summary"][sec]
            assert "rows" in d[sec]
        # spot-check a recipe row shape
        row = d["recipe"]["rows"][0]
        for f in ("key", "status", "current", "source", "changes"):
            assert f in row

    def test_compare_self_all_unchanged(self, admin):
        r = admin.get(f"{API}/products/{SRC_SKU}/compare/{SRC_SKU}")
        assert r.status_code == 200
        s = r.json()["summary"]
        for sec in s.values():
            assert sec["added"] == 0 and sec["removed"] == 0 and sec["changed"] == 0

    def test_compare_404_when_missing(self, admin):
        r = admin.get(f"{API}/products/NOT-EXIST/compare/{SRC_SKU}")
        assert r.status_code == 404
        assert "tidak ditemukan" in r.json()["detail"].lower()
        r2 = admin.get(f"{API}/products/{SRC_SKU}/compare/NOT-EXIST")
        assert r2.status_code == 404
        assert "tidak ditemukan" in r2.json()["detail"].lower()

    def test_recipe_diff_semantics(self, admin, setup_v2_with_diff):
        meta = setup_v2_with_diff
        d = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}").json()
        rsum = d["summary"]["recipe"]
        assert rsum["removed"] >= 1
        assert rsum["changed"] >= 1
        removed = [r for r in d["recipe"]["rows"] if r["status"] == "removed"]
        assert any(r["key"] == meta["removed_code"] for r in removed)
        rm_row = next(r for r in removed if r["key"] == meta["removed_code"])
        assert rm_row["current"] is None and rm_row["source"] is not None
        changed = [r for r in d["recipe"]["rows"] if r["status"] == "changed"]
        cr = next(r for r in changed if r["key"] == meta["changed_code"])
        assert "qty_per_pcs" in cr["changes"]
        assert "catatan_proses" in cr["changes"]

    def test_bundle_membership_change_detected(self, admin, setup_v2_with_diff):
        d = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}").json()
        # find bundle that originally contained GND-OUT
        rows = d["bundles"]["rows"]
        # search for a changed bundle whose source_cables includes removed cable
        affected = [b for b in rows if "GND-OUT" in (b.get("source_cables") or [])]
        assert affected, "expected a bundle to reference GND-OUT in source"
        b = affected[0]
        assert b["status"] == "changed"
        assert "cables_in_bundle" in b["changes"]
        assert "GND-OUT" not in (b.get("current_cables") or [])

    def test_pin_map_diff_structure(self, admin, setup_v2_with_diff):
        d = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}").json()
        rows = d["pin_map"]["rows"]
        # Every row that is changed/unchanged should expose pin_diff with summary
        for r in rows:
            if r["status"] in ("changed", "unchanged"):
                assert r["pin_diff"] is not None
                ps = r["pin_diff"]["summary"]
                for k in ("added", "removed", "changed", "unchanged"):
                    assert k in ps

    def test_work_instructions_step_diff_when_both(self, admin, setup_v2_with_diff):
        d = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}").json()
        rows = d["work_instructions"]["rows"]
        both = [r for r in rows if r["status"] in ("changed", "unchanged")]
        assert both, "expected at least one WI present in both"
        for r in both:
            assert r["step_diff"] is not None
            assert "rows" in r["step_diff"]

    def test_qc_keyed_by_nama_added(self, admin, setup_v2_with_diff):
        # Add a new QC item to V2 and ensure compare detects 'added' keyed by nama
        tmpl = admin.get(f"{API}/products/{self.NEW}/qc-template").json()
        items = list(tmpl.get("items", []))
        new_item = {
            "id": "qc-extra-1", "nama": "TEST_extra_qc_item",
            "cara_tes": "Test cara", "expected": "OK",
            "required": True, "urutan": 99,
        }
        items.append(new_item)
        body = {"product_sku": self.NEW, "items": items}
        r = admin.put(f"{API}/products/{self.NEW}/qc-template", json=body)
        assert r.status_code == 200
        d = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}").json()
        added_qc = [r for r in d["qc_template"]["rows"] if r["status"] == "added"]
        assert any(r["key"] == "TEST_extra_qc_item" for r in added_qc)

    def test_common_mistakes_keyed_by_kesalahan(self, admin, setup_v2_with_diff):
        # Add a new common mistake on V2; expect 'added' in compare
        payload = {
            "id": "cm-test-1", "product_sku": self.NEW,
            "kesalahan": "TEST_kesalahan_xyz",
            "akibat": "Akibatnya...",
            "cara_mencegah": "Hindari", "bundle_code": "A",
        }
        r = admin.post(f"{API}/products/{self.NEW}/common-mistakes", json=payload)
        assert r.status_code == 200
        d = admin.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}").json()
        added = [m for m in d["common_mistakes"]["rows"] if m["status"] == "added"]
        assert any(m["key"] == "TEST_kesalahan_xyz" for m in added)

    def test_role_access_all_three(self, admin, prod, qc, setup_v2_with_diff):
        for sess, name in ((admin, "admin"), (prod, "prod"), (qc, "qc")):
            r = sess.get(f"{API}/products/{self.NEW}/compare/{SRC_SKU}")
            assert r.status_code == 200, f"{name} got {r.status_code}: {r.text}"


# ============ P2C: Auto-Generated Production Briefing ============
class TestP2CBriefing:
    """Production Briefing snapshot attached to Work Orders made from cloned products."""

    NEW = "RFL-AOD-H11-V5"
    wo_with_briefing = None  # set in test_wo_create_cloned_attaches_briefing
    wo_v1_no_briefing = None

    @pytest.fixture(scope="class")
    def setup_v5_with_diff(self, admin):
        # Clean any previous V5 then clone
        _cleanup_versions(admin)  # also clears V2/V3/V4
        # additionally clean V5 directly
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history",
                     "work_orders"):
            db[coll].delete_many({"$or": [{"sku": self.NEW}, {"product_sku": self.NEW}]})

        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": self.NEW, "new_nama_produk": "Foglamp AOD V5 (Briefing Test)",
            "new_versi": "V5", "new_status": "Trial",
            "copy_recipe": True, "copy_bundles": True,
            "copy_work_instructions": True, "copy_pin_map": True,
            "copy_qc_template": True, "copy_common_mistakes": True,
            "hold_old": False,
        })
        assert r.status_code == 200, r.text

        # Mutate V5 recipe: drop GND-OUT and bump qty/catatan on another cable
        rec = admin.get(f"{API}/products/{SRC_SKU}/recipe").json()
        new_rec = []
        changed_code = None
        for c in rec:
            if c["cable_code"] == "GND-OUT":
                continue
            c2 = {k: v for k, v in c.items() if k != "cable_function"}
            if changed_code is None:
                c2["qty_per_pcs"] = (c.get("qty_per_pcs", 1) or 1) + 7
                c2["catatan_proses"] = (c.get("catatan_proses") or "") + " [P2C]"
                changed_code = c["cable_code"]
            new_rec.append(c2)
        r = admin.put(f"{API}/products/{self.NEW}/recipe", json=new_rec)
        assert r.status_code == 200, r.text
        return {"changed_code": changed_code, "removed_code": "GND-OUT"}

    def test_wo_create_cloned_attaches_briefing(self, prod, setup_v5_with_diff):
        meta = setup_v5_with_diff
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": self.NEW, "qty": 5, "reseller": "Briefing Test",
            "prioritas": "Normal", "catatan": "P2C",
        })
        assert r.status_code == 200, r.text
        wo = r.json()
        assert "briefing" in wo, "WO missing briefing snapshot"
        b = wo["briefing"]
        assert b["compared_to_sku"] == SRC_SKU
        assert b["summary_text"] and "berbeda" in b["summary_text"].lower()
        # changed_recipe_codes should include the changed cable, removed_recipe_codes the removed one
        assert meta["changed_code"] in b["changed_recipe_codes"]
        assert "GND-OUT" in b["removed_recipe_codes"]
        # changed_sections lists at least 'recipe'
        assert "recipe" in b["changed_sections"]
        # compare_url uses the new sku and source sku
        assert b["compare_url"] == f"/products/{self.NEW}/compare/{SRC_SKU}"
        # important_changes contains at least one entry
        assert isinstance(b["important_changes"], list) and len(b["important_changes"]) >= 1
        TestP2CBriefing.wo_with_briefing = wo["wo_number"]

    def test_wo_create_original_no_briefing(self, prod):
        # WO for SRC_SKU (root, no parent/source) should NOT have briefing
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": SRC_SKU, "qty": 1, "reseller": "Root Test",
            "prioritas": "Normal",
        })
        assert r.status_code == 200, r.text
        wo = r.json()
        # Either no briefing key or briefing is null/missing
        assert not wo.get("briefing"), f"unexpected briefing on root product: {wo.get('briefing')}"
        TestP2CBriefing.wo_v1_no_briefing = wo["wo_number"]

    def test_wo_detail_returns_briefing(self, admin):
        wo_num = TestP2CBriefing.wo_with_briefing
        assert wo_num, "predecessor test did not run"
        r = admin.get(f"{API}/work-orders/{wo_num}")
        assert r.status_code == 200, r.text
        wo = r.json()
        assert wo.get("briefing"), "GET WO should return briefing"
        assert wo["briefing"]["compared_to_sku"] == SRC_SKU

    def test_regenerate_briefing_after_mutation(self, admin, setup_v5_with_diff):
        wo_num = TestP2CBriefing.wo_with_briefing
        # Mutate recipe again: bump qty on another cable to add a new "changed" entry
        rec = admin.get(f"{API}/products/{self.NEW}/recipe").json()
        # Find a cable that hasn't been changed yet (first one not equal to changed_code)
        target = None
        for c in rec:
            if c["cable_code"] != setup_v5_with_diff["changed_code"]:
                target = c
                break
        assert target, "no target cable to mutate"
        new_rec = [{k: v for k, v in c.items() if k != "cable_function"} for c in rec]
        for c in new_rec:
            if c["cable_code"] == target["cable_code"]:
                c["qty_per_pcs"] = (c.get("qty_per_pcs", 1) or 1) + 13
                c["catatan_proses"] = (c.get("catatan_proses") or "") + " [REGEN]"
        r = admin.put(f"{API}/products/{self.NEW}/recipe", json=new_rec)
        assert r.status_code == 200, r.text

        # Regenerate briefing on WO
        r = admin.post(f"{API}/work-orders/{wo_num}/regenerate-briefing")
        assert r.status_code == 200, r.text
        wo = r.json()
        assert wo.get("briefing"), "briefing should be regenerated"
        # Now the briefing must include the newly changed cable
        assert target["cable_code"] in wo["briefing"]["changed_recipe_codes"]

    def test_regenerate_briefing_returns_none_for_root(self, admin):
        wo_num = TestP2CBriefing.wo_v1_no_briefing
        assert wo_num, "predecessor test did not run"
        r = admin.post(f"{API}/work-orders/{wo_num}/regenerate-briefing")
        assert r.status_code == 200, r.text
        wo = r.json()
        assert not wo.get("briefing"), "root product WO should not gain briefing on regenerate"

    def test_regenerate_briefing_role_qc_403(self, qc):
        wo_num = TestP2CBriefing.wo_with_briefing
        r = qc.post(f"{API}/work-orders/{wo_num}/regenerate-briefing")
        assert r.status_code == 403

    def test_regenerate_briefing_wo_not_found(self, admin):
        r = admin.post(f"{API}/work-orders/WO-NOT-EXIST-XYZ/regenerate-briefing")
        assert r.status_code == 404

    def test_cleanup_delete_wos(self, admin):
        for wo in (TestP2CBriefing.wo_with_briefing, TestP2CBriefing.wo_v1_no_briefing):
            if wo:
                admin.delete(f"{API}/work-orders/{wo}")
        # Cleanup V5 too
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history"):
            db[coll].delete_many({"$or": [{"sku": TestP2CBriefing.NEW}, {"product_sku": TestP2CBriefing.NEW}]})
        # Reset V1
        db.products.update_one({"sku": SRC_SKU}, {"$unset": {"version_group": "", "parent_sku": "", "source_sku": ""}, "$set": {"status": "Released"}})

# ============ P3A: Reference Photo Uploads ============
import io
import base64

# Tiny 1x1 PNG
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


def _png_file(name="test.png"):
    return {"file": (name, io.BytesIO(_PNG_BYTES), "image/png")}


class TestP3AUploads:
    BUNDLE_ID = "p3a-test-bundle-id"
    file_ids: list = []  # type: ignore[var-annotated]

    @classmethod
    def teardown_class(cls):
        # Soft-delete any remaining test files using admin session
        try:
            s = _sess(ADMIN)
            for fid in cls.file_ids:
                try: s.delete(f"{API}/files/{fid}")
                except Exception: pass
        except Exception: pass

    def _upload(self, sess, related_type, related_id, mime="image/png", caption=None, expect_status=200):
        files = {"file": ("t.png", io.BytesIO(_PNG_BYTES), mime)}
        data = {"related_type": related_type, "related_id": related_id}
        if caption:
            data["caption"] = caption
        r = sess.post(f"{API}/uploads", files=files, data=data)
        assert r.status_code == expect_status, f"{r.status_code} {r.text}"
        return r

    def test_upload_admin_bundle_ok(self, admin):
        r = self._upload(admin, "bundle", self.BUNDLE_ID, caption="cap1")
        d = r.json()
        assert d["related_type"] == "bundle"
        assert d["related_id"] == self.BUNDLE_ID
        assert d["mime_type"] == "image/png"
        assert d["size"] > 0
        assert d["uploaded_by"]
        assert d["file_url"].endswith(d["id"])
        TestP3AUploads.file_ids.append(d["id"])

    def test_list_files_returns_uploaded(self, admin):
        r = admin.get(f"{API}/files", params={"related_type": "bundle", "related_id": self.BUNDLE_ID})
        assert r.status_code == 200
        items = r.json()
        assert any(f["id"] in self.file_ids for f in items)

    def test_download_no_auth_ok(self):
        # Files are served without auth
        fid = self.file_ids[0]
        r = requests.get(f"{API}/files/{fid}", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert r.content == _PNG_BYTES

    def test_patch_caption(self, admin):
        fid = self.file_ids[0]
        r = admin.patch(f"{API}/files/{fid}", json={"caption": "Caption baru"})
        assert r.status_code == 200, r.text
        assert r.json()["caption"] == "Caption baru"

    def test_bulk_by_related(self, admin):
        r = admin.post(f"{API}/files/bulk-by-related", json={
            "related_type": "bundle",
            "related_ids": [self.BUNDLE_ID, "does-not-exist"],
        })
        assert r.status_code == 200
        d = r.json()
        assert self.BUNDLE_ID in d
        assert "does-not-exist" not in d

    def test_qc_can_upload_qc_evidence(self, qc):
        r = self._upload(qc, "qc_evidence", "WO-TEST-001:qc-item-1")
        TestP3AUploads.file_ids.append(r.json()["id"])

    def test_qc_cannot_upload_bundle(self, qc):
        self._upload(qc, "bundle", "another-id", expect_status=403)

    def test_production_cannot_upload(self, prod):
        self._upload(prod, "bundle", "another-id", expect_status=403)

    def test_production_cannot_upload_qc(self, prod):
        self._upload(prod, "qc_evidence", "WO-X:item", expect_status=403)

    def test_reject_bad_mime(self, admin):
        files = {"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
        data = {"related_type": "bundle", "related_id": "x"}
        r = admin.post(f"{API}/uploads", files=files, data=data)
        assert r.status_code == 415

    def test_reject_bad_related_type(self, admin):
        files = {"file": ("t.png", io.BytesIO(_PNG_BYTES), "image/png")}
        data = {"related_type": "unknown_thing", "related_id": "x"}
        r = admin.post(f"{API}/uploads", files=files, data=data)
        assert r.status_code == 400

    def test_reject_oversized(self, admin):
        big = b"\x00" * (5 * 1024 * 1024 + 1)
        files = {"file": ("big.png", io.BytesIO(big), "image/png")}
        data = {"related_type": "bundle", "related_id": "x"}
        r = admin.post(f"{API}/uploads", files=files, data=data)
        assert r.status_code == 413

    def test_qc_cannot_delete_bundle_photo(self, qc):
        # First, admin file from earlier
        bundle_fid = self.file_ids[0]
        r = qc.delete(f"{API}/files/{bundle_fid}")
        assert r.status_code == 403

    def test_qc_can_delete_own_qc_evidence(self, qc):
        # qc uploads then deletes
        r = self._upload(qc, "qc_evidence", "WO-TEST-002:qc-item-1")
        fid = r.json()["id"]
        del_r = qc.delete(f"{API}/files/{fid}")
        assert del_r.status_code == 200
        # confirm 404 on download
        d = requests.get(f"{API}/files/{fid}", timeout=30)
        assert d.status_code == 404

    def test_admin_delete_bundle_photo(self, admin):
        fid = self.file_ids[0]
        r = admin.delete(f"{API}/files/{fid}")
        assert r.status_code == 200
        # gone from list
        items = admin.get(f"{API}/files", params={"related_type": "bundle", "related_id": self.BUNDLE_ID}).json()
        assert all(f["id"] != fid for f in items)

    def test_unauthenticated_upload_blocked(self):
        files = {"file": ("t.png", io.BytesIO(_PNG_BYTES), "image/png")}
        data = {"related_type": "bundle", "related_id": "x"}
        r = requests.post(f"{API}/uploads", files=files, data=data, timeout=30)
        assert r.status_code == 401

    def test_file_not_found(self, admin):
        r = admin.get(f"{API}/files/nonexistent-id-xyz")
        assert r.status_code == 404



# ============ P3A enhancement: Salin Foto Referensi pada Clone ============
class TestP3APhotoClone:
    NEW = "RFL-AOD-H11-V7"
    SRC = SRC_SKU
    bundle_old_id = None
    bundle_new_id = None
    bundle_old_code = None
    mistake_old_id = None
    mistake_new_id = None
    src_photo_ids: list = []   # photos created on V1 for testing
    new_photo_ids: list = []   # photos cloned to V7

    @pytest.fixture(scope="class")
    def setup_src_photos(self, admin):
        """Ensure V1 has at least one photo per related_type, then return mapping for use in tests."""
        # Cleanup any prior V7
        s = _sess(ADMIN)
        s.delete(f"{API}/work-orders/_noop")  # noop
        # Hard cleanup via motor in case prior test left state
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history"):
            db[coll].delete_many({"$or": [{"sku": self.NEW}, {"product_sku": self.NEW}]})
        # remove any prior test photos on V1 created by this class
        db.file_assets.delete_many({"product_sku": self.SRC, "uploaded_by": {"$in": ["Arif"]},
                                    "caption": {"$regex": "^P3A-CLONE-TEST"}})

        # Find a bundle on V1 and a mistake on V1
        bundles = admin.get(f"{API}/products/{self.SRC}/bundles").json()
        mistakes = admin.get(f"{API}/products/{self.SRC}/common-mistakes").json()
        assert bundles and mistakes, "seed must have bundles/mistakes"

        bundle = bundles[0]
        mistake = mistakes[0]
        wi_bundle_code = bundle["bundle_code"]  # work_instruction is keyed by bundle_code

        TestP3APhotoClone.bundle_old_id = bundle["id"]
        TestP3APhotoClone.bundle_old_code = bundle["bundle_code"]
        TestP3APhotoClone.mistake_old_id = mistake["id"]

        # Upload 3 photos on V1
        def up(rt, rid, caption):
            files = {"file": ("t.png", io.BytesIO(_PNG_BYTES), "image/png")}
            data = {"related_type": rt, "related_id": rid, "product_sku": self.SRC, "caption": caption}
            r = admin.post(f"{API}/uploads", files=files, data=data)
            assert r.status_code == 200, r.text
            return r.json()["id"]

        a = up("bundle", bundle["id"], "P3A-CLONE-TEST bundle photo")
        b = up("work_instruction_step", f"{self.SRC}:{wi_bundle_code}:1", "P3A-CLONE-TEST step photo")
        c = up("common_mistake", mistake["id"], "P3A-CLONE-TEST mistake photo")
        TestP3APhotoClone.src_photo_ids = [a, b, c]
        return {"bundle_id": bundle["id"], "wi_bundle_code": wi_bundle_code, "mistake_id": mistake["id"]}

    def test_clone_with_copy_photos_creates_metadata(self, admin, setup_src_photos):
        r = admin.post(f"{API}/products/{self.SRC}/clone", json={
            "new_sku": self.NEW, "new_nama_produk": "Clone Photo Test", "new_versi": "V7",
            "new_status": "Trial",
            "copy_recipe": True, "copy_bundles": True, "copy_work_instructions": True,
            "copy_pin_map": True, "copy_qc_template": True, "copy_common_mistakes": True,
            "copy_photos": True, "hold_old": False,
        })
        assert r.status_code == 200, r.text
        copied = r.json()["copied"]
        # 3 photos expected (1 bundle + 1 step + 1 mistake)
        assert copied.get("photos") == 3, f"photos copied={copied.get('photos')}"

        # Capture new bundle/mistake ids
        new_bundles = admin.get(f"{API}/products/{self.NEW}/bundles").json()
        new_mistakes = admin.get(f"{API}/products/{self.NEW}/common-mistakes").json()
        new_b = next(b for b in new_bundles if b["bundle_code"] == self.bundle_old_code)
        new_m = next(m for m in new_mistakes if m["kesalahan"] == admin.get(f"{API}/products/{self.SRC}/common-mistakes").json()[0]["kesalahan"])
        TestP3APhotoClone.bundle_new_id = new_b["id"]
        TestP3APhotoClone.mistake_new_id = new_m["id"]
        assert new_b["id"] != self.bundle_old_id
        assert new_m["id"] != self.mistake_old_id

    def test_cloned_bundle_has_photo_linked_to_source(self, admin):
        r = admin.get(f"{API}/files", params={"related_type": "bundle", "related_id": self.bundle_new_id})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        a = items[0]
        # Source link tracked
        assert a["source_file_id"] == self.src_photo_ids[0]
        # New file_url points to new id
        assert a["file_url"] == f"/api/files/{a['id']}"
        # Storage path SAME as source (no duplicate upload)
        src = admin.get(f"{API}/files", params={"related_type": "bundle", "related_id": self.bundle_old_id}).json()[0]
        assert a["storage_path"] == src["storage_path"]
        # Caption initial value copied
        assert a["caption"] == src["caption"]
        # product_sku is new
        assert a["product_sku"] == self.NEW
        TestP3APhotoClone.new_photo_ids.append(a["id"])

    def test_cloned_step_photo(self, admin):
        new_rid = f"{self.NEW}:{self.bundle_old_code}:1"
        r = admin.get(f"{API}/files", params={"related_type": "work_instruction_step", "related_id": new_rid})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        a = items[0]
        assert a["source_file_id"] == self.src_photo_ids[1]
        assert a["product_sku"] == self.NEW
        TestP3APhotoClone.new_photo_ids.append(a["id"])

    def test_cloned_mistake_photo(self, admin):
        r = admin.get(f"{API}/files", params={"related_type": "common_mistake", "related_id": self.mistake_new_id})
        items = r.json()
        assert len(items) == 1
        a = items[0]
        assert a["source_file_id"] == self.src_photo_ids[2]
        TestP3APhotoClone.new_photo_ids.append(a["id"])

    def test_delete_on_clone_does_not_delete_source(self, admin):
        clone_pid = self.new_photo_ids[0]
        src_pid = self.src_photo_ids[0]
        r = admin.delete(f"{API}/files/{clone_pid}")
        assert r.status_code == 200
        # source still downloadable
        d = requests.get(f"{API}/files/{src_pid}", timeout=30)
        assert d.status_code == 200, "deleting clone photo must NOT affect source"
        # clone is gone
        d2 = requests.get(f"{API}/files/{clone_pid}", timeout=30)
        assert d2.status_code == 404

    def test_caption_edit_on_clone_independent(self, admin):
        # Mistake photo: edit caption on clone
        clone_pid = self.new_photo_ids[2]
        src_pid = self.src_photo_ids[2]
        r = admin.patch(f"{API}/files/{clone_pid}", json={"caption": "Caption khusus V7"})
        assert r.status_code == 200
        # source caption unchanged
        src = admin.get(f"{API}/files", params={"related_type": "common_mistake", "related_id": self.mistake_old_id}).json()[0]
        assert src["caption"] == "P3A-CLONE-TEST mistake photo"
        assert src["id"] == src_pid

    def test_replace_on_clone_creates_new_storage_object(self, admin):
        """When user replaces a cloned photo, frontend uploads a NEW file then soft-deletes the old.
        Simulate this and confirm new storage_path differs from source's storage_path."""
        clone_pid = self.new_photo_ids[1]
        src_pid = self.src_photo_ids[1]
        src_doc = admin.get(f"{API}/files", params={"related_type": "work_instruction_step",
                                                     "related_id": f"{self.SRC}:{TestP3APhotoClone.bundle_old_code}:1"}).json()[0]
        new_rid = f"{self.NEW}:{TestP3APhotoClone.bundle_old_code}:1"

        # Upload new photo for that same related_id
        files = {"file": ("replace.png", io.BytesIO(_PNG_BYTES + b"x"), "image/png")}
        data = {"related_type": "work_instruction_step", "related_id": new_rid, "product_sku": self.NEW}
        r = admin.post(f"{API}/uploads", files=files, data=data)
        assert r.status_code == 200
        new_doc = r.json()
        assert new_doc["storage_path"] != src_doc["storage_path"], "replace must not share storage with source"
        admin.delete(f"{API}/files/{clone_pid}")
        src_check = requests.get(f"{API}/files/{src_pid}", timeout=30)
        assert src_check.status_code == 200

    def test_revision_history_records_photo_copy(self, admin):
        r = admin.get(f"{API}/products/{self.NEW}/revisions")
        if r.status_code == 404:
            # endpoint name may differ; try alt
            r = admin.get(f"{API}/products/{self.NEW}/revision-history")
        # Accept either 200 with content; if endpoint doesn't exist, fall back to direct DB check
        if r.status_code == 200:
            revs = r.json()
            assert any("Foto referensi" in (x.get("bagian_berubah") or "") or
                       "Foto referensi disalin" in (x.get("alasan") or "") for x in revs), revs
        else:
            # direct DB check
            import pymongo, os
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = cli[os.environ.get("DB_NAME", "test_database")]
            found = db.revision_history.find_one({
                "product_sku": self.NEW,
                "bagian_berubah": "Foto Referensi",
            })
            assert found, "revision_history must include 'Foto Referensi' entry on clone with copy_photos=true"

    def test_clone_without_copy_photos(self, admin):
        # Clone again to V8 without copy_photos
        sku2 = "RFL-AOD-H11-V8"
        # Cleanup first
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history", "file_assets"):
            db[coll].delete_many({"$or": [{"sku": sku2}, {"product_sku": sku2}]})

        r = admin.post(f"{API}/products/{self.SRC}/clone", json={
            "new_sku": sku2, "new_nama_produk": "No Photos", "new_versi": "V8",
            "new_status": "Trial",
            "copy_recipe": True, "copy_bundles": True, "copy_work_instructions": True,
            "copy_pin_map": True, "copy_qc_template": True, "copy_common_mistakes": True,
            "copy_photos": False, "hold_old": False,
        })
        assert r.status_code == 200, r.text
        assert "photos" not in r.json()["copied"] or r.json()["copied"].get("photos") == 0
        # Verify no file_assets on V8
        cnt = db.file_assets.count_documents({"product_sku": sku2, "is_deleted": False})
        assert cnt == 0
        # cleanup
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history", "file_assets"):
            db[coll].delete_many({"$or": [{"sku": sku2}, {"product_sku": sku2}]})

    def test_cleanup(self, admin):
        # Hard delete test data
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history"):
            db[coll].delete_many({"$or": [{"sku": self.NEW}, {"product_sku": self.NEW}]})
        # Remove all test file_assets created by this class
        db.file_assets.delete_many({"$or": [
            {"product_sku": self.NEW},
            {"id": {"$in": TestP3APhotoClone.src_photo_ids + TestP3APhotoClone.new_photo_ids}},
            {"caption": {"$regex": "^P3A-CLONE-TEST"}},
            {"caption": "Caption khusus V7"},
        ]})
        # Restore V1 if marked Hold
        db.products.update_one({"sku": self.SRC}, {"$unset": {"version_group": "", "parent_sku": "", "source_sku": ""},
                                                   "$set": {"status": "Released"}})

# ============ P3B: Operator Progress ============
class TestP3BOperatorProgress:
    """Step-checkbox progress for operator view."""

    wo_number: str = None

    @pytest.fixture(scope="class")
    def setup_wo(self, prod):
        # Create WO for V1 (root, no briefing); cleanup any leftover after class
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": SRC_SKU, "qty": 2, "reseller": "Operator Test", "prioritas": "Normal",
        })
        assert r.status_code == 200, r.text
        TestP3BOperatorProgress.wo_number = r.json()["wo_number"]
        # Defensive: purge any leftover progress for this WO number (counter may collide with prior runs)
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        db.operator_progress.delete_many({"wo_number": TestP3BOperatorProgress.wo_number})
        return TestP3BOperatorProgress.wo_number

    @classmethod
    def teardown_class(cls):
        if cls.wo_number:
            try:
                s = _sess(ADMIN)
                s.delete(f"{API}/work-orders/{cls.wo_number}")
            except Exception:
                pass
            import pymongo, os
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = cli[os.environ.get("DB_NAME", "test_database")]
            db.operator_progress.delete_many({"wo_number": cls.wo_number})

    def test_initial_get_empty(self, prod, setup_wo):
        wo = setup_wo
        r = prod.get(f"{API}/work-orders/{wo}/operator-progress")
        assert r.status_code == 200
        d = r.json()
        assert d["wo_number"] == wo
        assert d["items"] == []
        assert d["summary"], "summary should list bundles"
        # Bundle A in seed has 5 steps
        a = next(x for x in d["summary"] if x["bundle_code"] == "A")
        assert a["total_steps"] == 5
        assert a["checked_steps"] == 0
        assert a["completed"] is False

    def test_check_step_updates_summary(self, prod, setup_wo):
        wo = setup_wo
        r = prod.post(f"{API}/work-orders/{wo}/operator-progress", json={
            "bundle_code": "A", "step_number": 1, "checked": True,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checked"] is True
        assert d["checked_by"]
        assert d["checked_at"]

        # GET reflects the change
        r2 = prod.get(f"{API}/work-orders/{wo}/operator-progress")
        items = r2.json()["items"]
        assert len(items) == 1
        a = next(x for x in r2.json()["summary"] if x["bundle_code"] == "A")
        assert a["checked_steps"] == 1
        assert a["completed"] is False

    def test_check_all_steps_marks_completed(self, prod, setup_wo):
        wo = setup_wo
        # Check remaining 4 steps of A (already checked 1)
        for n in [2, 3, 4, 5]:
            r = prod.post(f"{API}/work-orders/{wo}/operator-progress", json={
                "bundle_code": "A", "step_number": n, "checked": True,
            })
            assert r.status_code == 200
        # Summary completed
        r = prod.get(f"{API}/work-orders/{wo}/operator-progress")
        a = next(x for x in r.json()["summary"] if x["bundle_code"] == "A")
        assert a["checked_steps"] == 5
        assert a["completed"] is True

    def test_toggle_uncheck_clears_metadata(self, prod, setup_wo):
        wo = setup_wo
        r = prod.post(f"{API}/work-orders/{wo}/operator-progress", json={
            "bundle_code": "A", "step_number": 1, "checked": False,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["checked"] is False
        assert d["checked_by"] is None
        assert d["checked_at"] is None
        # Summary reflects decrement
        r2 = prod.get(f"{API}/work-orders/{wo}/operator-progress")
        a = next(x for x in r2.json()["summary"] if x["bundle_code"] == "A")
        assert a["checked_steps"] == 4
        assert a["completed"] is False

    def test_idempotent_upsert(self, prod, setup_wo):
        wo = setup_wo
        # Same step re-set to True twice; only one row should exist
        for _ in range(2):
            r = prod.post(f"{API}/work-orders/{wo}/operator-progress", json={
                "bundle_code": "B", "step_number": 1, "checked": True,
            })
            assert r.status_code == 200
        items = prod.get(f"{API}/work-orders/{wo}/operator-progress").json()["items"]
        matching = [it for it in items if it["bundle_code"] == "B" and it["step_number"] == 1]
        assert len(matching) == 1

    def test_qc_can_read(self, qc, setup_wo):
        wo = setup_wo
        r = qc.get(f"{API}/work-orders/{wo}/operator-progress")
        assert r.status_code == 200

    def test_qc_cannot_write(self, qc, setup_wo):
        wo = setup_wo
        r = qc.post(f"{API}/work-orders/{wo}/operator-progress", json={
            "bundle_code": "C", "step_number": 1, "checked": True,
        })
        assert r.status_code == 403

    def test_unauthenticated_blocked(self, setup_wo):
        wo = setup_wo
        r = requests.get(f"{API}/work-orders/{wo}/operator-progress", timeout=30)
        assert r.status_code == 401
        r2 = requests.post(f"{API}/work-orders/{wo}/operator-progress",
                           json={"bundle_code": "A", "step_number": 1, "checked": True}, timeout=30)
        assert r2.status_code == 401

    def test_unknown_wo_404(self, admin):
        r = admin.get(f"{API}/work-orders/WO-NOT-EXIST-OPV/operator-progress")
        assert r.status_code == 404
        r2 = admin.post(f"{API}/work-orders/WO-NOT-EXIST-OPV/operator-progress",
                        json={"bundle_code": "A", "step_number": 1, "checked": True})
        assert r2.status_code == 404

    def test_progress_isolated_per_wo(self, prod, admin):
        # Create a 2nd WO and verify progress data does not leak between WOs
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": SRC_SKU, "qty": 1, "reseller": "Isolation", "prioritas": "Normal",
        })
        assert r.status_code == 200
        wo2 = r.json()["wo_number"]
        try:
            r2 = prod.get(f"{API}/work-orders/{wo2}/operator-progress")
            assert r2.json()["items"] == [], "fresh WO must start empty"
            # Setting on wo2 must NOT affect main wo
            prod.post(f"{API}/work-orders/{wo2}/operator-progress", json={
                "bundle_code": "A", "step_number": 1, "checked": True,
            })
            wo_main_items = prod.get(f"{API}/work-orders/{self.wo_number}/operator-progress").json()["items"]
            assert all(it["wo_number"] == self.wo_number for it in wo_main_items)
        finally:
            admin.delete(f"{API}/work-orders/{wo2}")
            import pymongo, os
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = cli[os.environ.get("DB_NAME", "test_database")]
            db.operator_progress.delete_many({"wo_number": wo2})


# ============ Cutting Sheet Sort (P3C) ============
class TestCuttingSheetSort:
    """Cutting sheet rows must be ordered by ukuran -> warna -> cable_code."""

    wo_number: str = None

    @pytest.fixture(scope="class")
    def setup_wo(self, prod):
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": SRC_SKU, "qty": 2, "reseller": "Sort Test", "prioritas": "Normal",
        })
        assert r.status_code == 200, r.text
        TestCuttingSheetSort.wo_number = r.json()["wo_number"]
        return TestCuttingSheetSort.wo_number

    @classmethod
    def teardown_class(cls):
        if cls.wo_number:
            try:
                s = _sess(ADMIN)
                s.delete(f"{API}/work-orders/{cls.wo_number}")
            except Exception:
                pass
            import pymongo, os
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = cli[os.environ.get("DB_NAME", "test_database")]
            db.batch_colors.delete_many({"wo_number": cls.wo_number})

    @staticmethod
    def _ukuran_num(s):
        import re as _re
        if not s:
            return float("inf")
        m = _re.search(r"\d+(?:[\.,]\d+)?", str(s))
        return float(m.group(0).replace(",", ".")) if m else float("inf")

    def test_rows_sorted_by_ukuran_asc(self, prod, setup_wo):
        wo = setup_wo
        r = prod.get(f"{API}/work-orders/{wo}/cutting-sheet")
        assert r.status_code == 200
        rows = r.json()["rows"]
        assert rows, "must have rows"
        nums = [self._ukuran_num(r["ukuran_kabel"]) for r in rows]
        assert nums == sorted(nums), f"ukuran not monotonic ascending: {nums}"

    def test_within_ukuran_sorted_by_warna(self, prod, setup_wo):
        wo = setup_wo
        rows = prod.get(f"{API}/work-orders/{wo}/cutting-sheet").json()["rows"]
        # Group by ukuran and check warna order within each group
        groups: dict = {}
        for r in rows:
            groups.setdefault(r["ukuran_kabel"], []).append((r["warna_aktual"] or "").lower())
        for uk, warnas in groups.items():
            assert warnas == sorted(warnas), f"within ukuran '{uk}' warna not sorted: {warnas}"

    def test_within_warna_sorted_by_cable_code(self, prod, setup_wo):
        wo = setup_wo
        rows = prod.get(f"{API}/work-orders/{wo}/cutting-sheet").json()["rows"]
        groups: dict = {}
        for r in rows:
            key = (r["ukuran_kabel"], (r["warna_aktual"] or "").lower())
            groups.setdefault(key, []).append(r["cable_code"])
        for k, codes in groups.items():
            assert codes == sorted(codes), f"in {k} cable_code not sorted: {codes}"

    def test_batch_color_substitution_affects_sort(self, prod, setup_wo):
        """Setting a substitusi color should reflow the sort order based on warna_aktual."""
        wo = setup_wo
        # find a 0.5mm cable that's normally one color; substitute it to a different color
        rows = prod.get(f"{API}/work-orders/{wo}/cutting-sheet").json()["rows"]
        target = next((r for r in rows if str(r["ukuran_kabel"]).startswith("0.5") and not r["warna_wajib"]), None)
        if not target:
            pytest.skip("no non-mandatory 0.5mm cable to test substitution sort")
        # Substitute to "Zebra" (lexicographically last, no alasan needed because not warna_wajib)
        r = prod.post(f"{API}/work-orders/{wo}/batch-colors", json={
            "cable_code": target["cable_code"], "warna_aktual": "Zebra",
        })
        assert r.status_code == 200, r.text
        # Re-fetch and verify the substituted cable moved within its ukuran group
        rows2 = prod.get(f"{API}/work-orders/{wo}/cutting-sheet").json()["rows"]
        size05 = [r for r in rows2 if str(r["ukuran_kabel"]).startswith("0.5")]
        # The substituted one must now be at the LAST position in the 0.5mm group
        assert size05[-1]["cable_code"] == target["cable_code"], \
            f"after substituting to 'Zebra', cable should sort last in its ukuran group; got {[r['cable_code'] for r in size05]}"


# ============ P3D: Delete Product & Delete WO ============
class TestP3DDelete:
    """Product delete (with cascade) + WO delete (with cascade)."""

    NEW_SKU = "RFL-AOD-H11-DEL"
    CHILD_SKU = "RFL-AOD-H11-DELCHILD"
    wo_number: str = None

    @classmethod
    def teardown_class(cls):
        # Nuclear cleanup
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        for coll in ("products", "product_cables", "product_bundles", "work_instructions",
                     "relay_pin_maps", "qc_templates", "common_mistakes", "revision_history",
                     "work_orders", "batch_colors", "qc_results", "operator_progress"):
            db[coll].delete_many({"$or": [
                {"sku": cls.NEW_SKU}, {"product_sku": cls.NEW_SKU},
                {"sku": cls.CHILD_SKU}, {"product_sku": cls.CHILD_SKU},
                {"wo_number": cls.wo_number} if cls.wo_number else {"wo_number": "_none_"},
            ]})
        db.file_assets.delete_many({"$or": [
            {"product_sku": cls.NEW_SKU}, {"product_sku": cls.CHILD_SKU},
        ]})
        # Reset V1 in case it was made a parent
        db.products.update_one({"sku": SRC_SKU}, {"$unset": {"version_group": "", "parent_sku": "", "source_sku": ""},
                                                  "$set": {"status": "Released"}})

    @pytest.fixture(scope="class")
    def clone_v1_to_del(self, admin):
        r = admin.post(f"{API}/products/{SRC_SKU}/clone", json={
            "new_sku": self.NEW_SKU, "new_nama_produk": "Del Test",
            "new_versi": "VDEL", "new_status": "Trial",
            "copy_recipe": True, "copy_bundles": True, "copy_work_instructions": True,
            "copy_pin_map": True, "copy_qc_template": True, "copy_common_mistakes": True,
            "copy_photos": False, "hold_old": False,
        })
        assert r.status_code == 200, r.text
        return self.NEW_SKU

    # ---- Product delete ----
    def test_delete_product_qc_forbidden(self, qc, clone_v1_to_del):
        r = qc.delete(f"{API}/products/{clone_v1_to_del}")
        assert r.status_code == 403

    def test_delete_product_prod_forbidden(self, prod, clone_v1_to_del):
        r = prod.delete(f"{API}/products/{clone_v1_to_del}")
        assert r.status_code == 403

    def test_delete_product_not_found(self, admin):
        r = admin.delete(f"{API}/products/RFL-DOES-NOT-EXIST-XYZ")
        assert r.status_code == 404

    def test_delete_product_refuses_when_wo_exists(self, admin, prod, clone_v1_to_del):
        # Create a WO on the product
        r = prod.post(f"{API}/work-orders", json={
            "product_sku": clone_v1_to_del, "qty": 1, "reseller": "Del Test", "prioritas": "Normal",
        })
        assert r.status_code == 200
        wo_num = r.json()["wo_number"]
        TestP3DDelete.wo_number = wo_num
        # Try to delete product -> 409
        r = admin.delete(f"{API}/products/{clone_v1_to_del}")
        assert r.status_code == 409
        assert "work order" in r.json()["detail"].lower() or "wo" in r.json()["detail"].lower()

    def test_delete_wo_qc_forbidden(self, qc):
        wo = TestP3DDelete.wo_number
        assert wo, "predecessor test didn't run"
        r = qc.delete(f"{API}/work-orders/{wo}")
        assert r.status_code == 403

    def test_delete_wo_prod_forbidden(self, prod):
        wo = TestP3DDelete.wo_number
        r = prod.delete(f"{API}/work-orders/{wo}")
        assert r.status_code == 403

    def test_delete_wo_not_found(self, admin):
        r = admin.delete(f"{API}/work-orders/WO-XYZ-DOES-NOT-EXIST-123")
        assert r.status_code == 404

    def test_delete_wo_cascades(self, admin, prod):
        wo = TestP3DDelete.wo_number
        # Seed some data that should cascade
        prod.post(f"{API}/work-orders/{wo}/batch-colors", json={
            "cable_code": "DEV-OUT-L", "warna_aktual": "Merah",
        })
        prod.post(f"{API}/work-orders/{wo}/operator-progress", json={
            "bundle_code": "A", "step_number": 1, "checked": True,
        })
        # Delete WO
        r = admin.delete(f"{API}/work-orders/{wo}")
        assert r.status_code == 200
        # Verify gone + cascade rows gone
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        assert db.work_orders.count_documents({"wo_number": wo}) == 0
        assert db.batch_colors.count_documents({"wo_number": wo}) == 0
        assert db.operator_progress.count_documents({"wo_number": wo}) == 0
        TestP3DDelete.wo_number = None  # cleaned

    def test_delete_product_refuses_when_child_version_exists(self, admin, clone_v1_to_del):
        # After WO is gone, still refuses because a child version was created earlier?
        # No child yet — create one to test the parent-guard branch.
        r = admin.post(f"{API}/products/{clone_v1_to_del}/clone", json={
            "new_sku": self.CHILD_SKU, "new_nama_produk": "Child of Del",
            "new_versi": "VCHLD", "new_status": "Trial",
            "copy_recipe": False, "copy_bundles": False, "copy_work_instructions": False,
            "copy_pin_map": False, "copy_qc_template": False, "copy_common_mistakes": False,
            "copy_photos": False, "hold_old": False,
        })
        assert r.status_code == 200
        # Try to delete parent -> 409
        r = admin.delete(f"{API}/products/{clone_v1_to_del}")
        assert r.status_code == 409
        assert "turunan" in r.json()["detail"].lower() or "child" in r.json()["detail"].lower() or "parent" in r.json()["detail"].lower()

    def test_delete_child_product_first_then_parent(self, admin, clone_v1_to_del):
        # Delete child first
        r = admin.delete(f"{API}/products/{self.CHILD_SKU}")
        assert r.status_code == 200
        # Now parent can be deleted
        r = admin.delete(f"{API}/products/{clone_v1_to_del}")
        assert r.status_code == 200, r.text
        # Verify cascade
        import pymongo, os
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cli[os.environ.get("DB_NAME", "test_database")]
        assert db.products.count_documents({"sku": clone_v1_to_del}) == 0
        assert db.product_cables.count_documents({"product_sku": clone_v1_to_del}) == 0
        assert db.product_bundles.count_documents({"product_sku": clone_v1_to_del}) == 0
        assert db.work_instructions.count_documents({"product_sku": clone_v1_to_del}) == 0
        assert db.relay_pin_maps.count_documents({"product_sku": clone_v1_to_del}) == 0
        assert db.qc_templates.count_documents({"product_sku": clone_v1_to_del}) == 0
        assert db.common_mistakes.count_documents({"product_sku": clone_v1_to_del}) == 0
        assert db.revision_history.count_documents({"product_sku": clone_v1_to_del}) == 0

    def test_seed_product_still_intact_after_all_deletes(self, admin):
        # Sanity: RFL-AOD-H11-V1 (seed) must NEVER be affected
        r = admin.get(f"{API}/products/{SRC_SKU}")
        assert r.status_code == 200
        assert r.json()["sku"] == SRC_SKU

