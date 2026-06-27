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
    test_skus = ["RFL-AOD-H11-V2", "RFL-AOD-H11-V3", "RFL-STD-H11-V1"]
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
    if request.cls.__name__ == "TestP2AClone":
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
