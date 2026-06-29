# RelayLab Production System — PRD

## Problem Statement
Internal web app for RelayLab Autolight to document production of automotive relay sets
(biled foglamp relay, headlamp relay, lampu tembak, etc). Goal: convert owner's tacit
knowledge into a documented system so production team can run complex products without
owner intervention. Principle: **Function First, Color Second** — cable identity is
function + size + length; color is per-batch and substitutable (with warnings for
mandatory-color cables like power/ground).

## Stack
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + lucide-react + qrcode.react
- **Backend**: FastAPI (Python) + Motor (MongoDB async)
- **Database**: MongoDB
- **Auth**: Session-cookie (bcrypt password hash, HttpOnly cookie, 30-day session)
- **Lang**: Bahasa Indonesia (UI)

## User Personas
1. **Admin / Owner (arif)** — Full access; creates/edits products, recipes, bundles, pin maps, instructions, QC templates; approves Released; manages users.
2. **Production Leader / Operator (redi, windu, dede, fauzi)** — Creates WO, views recipes/instructions, sets batch colors, marks cutting done, updates production status.
3. **QC (leni)** — Views WO, executes QC checklist (Pass/Fail/Notes), submits results.

## Modules Implemented (v1.0, Feb 2026)
- Login + session-cookie auth + change password
- Dashboard with WO stats and recent WO
- Products (list, detail with 6 tabs: Recipe / Bundles / Pin Map / QC Template / Common Mistakes / Revisi), Approve to Released
- Cable Function Master (CRUD, search, category filter)
- Machine Program Master (CRUD, cable-code linking)
- Work Orders (list, filter, create, status workflow, delete)
- Work Order Detail (cutting sheet auto-generated, batch color input with warnings, bundle labels, pin map, QC)
- Bundle Detail page (QR target: `/work-orders/{wo_number}/bundles/{bundle_code}`) with step-by-step instruction, common mistakes, prev/next navigation
- Print views (browser print + @media print CSS): Cutting Sheet, Bundle Labels with QR, Pin Map, QC Checklist
- Training Matrix (per employee × product × skill level)
- Users CRUD (Admin only)
- Seed data for full RFL-AOD-H11-V1 product (17 cables, 10 bundles, 3 relays, 10 QC items, 4 mistakes, 6 employees, 14 machine programs)

## Phase P1 (v1.1, Feb 2026)
- **UI CRUD Product Recipe** — `RecipeEditor` with inline-editable table, cable-code combobox from master, bundle assignment, urutan, skun A/B, solder, catatan
- **UI CRUD Product Bundle** — `BundleEditor` with grid cards + add/edit dialog (code, name, fungsi, urutan, instruksi singkat, target relay pin); per-bundle "Edit Work Instruction" entry
- **UI CRUD Work Instruction** — `WorkInstructionEditor` step-by-step with reorder up/down, fields: instruksi, komponen, tools, safety, common_mistake, foto_url (placeholder)
- **UI CRUD Relay Pin Map** — `PinMapEditor` with relay add/edit (number/name/type 4 or 5 pin) + per-pin cable_code & fungsi
- **UI CRUD QC Template** — `QcTemplateEditor` inline items (nama, cara_tes, expected, required, reorder)
- **Auto Revision History** — every PUT (recipe/bundles/work-instructions/pin-map/qc-template) inserts an entry in `revision_history` with diubah_oleh + bagian_berubah; for Released products, catatan_approval = "Produk Released — disarankan buat versi baru."
- **Released product warning** — All 5 editors show AlertDialog before save when product.status='Released' (recommend create new version)
- **Training Matrix recommendation** — `GET /api/training-matrix?product_sku=X&qualified_only=true` filter; WO creation dialog auto-shows operator badges for the chosen product (Bisa mandiri / Trainer only)
- **Backend tests** — `/app/backend/tests/test_relaylab_backend.py` 39/39 pass

## Phase P2A (v1.2, Feb 2026) — Product Versioning & Clone
- Added `parent_sku`, `source_sku`, `version_group` fields to Product model
- `GET /api/products/{sku}/suggest-version` (Admin) auto-suggests next SKU (V1 → V2 → V3) by regex
- `POST /api/products/{sku}/clone` (Admin) deep-copies selected sub-collections (recipe, bundles, work instructions, pin map, QC template, common mistakes) with regenerated unique ids; sets versioning relations on new and source
- Auto revision entry on new product: "Clone produk" + catatan_approval "Clone dari {source}"; on old product (when `hold_old=true`) Hold revision with new SKU mentioned and status set to Hold
- Frontend `CloneProductDialog` with prefill, all-checked-by-default copy options, status (Draft/Trial), hold_old checkbox; SKU collision toast; success → navigates to new product
- Frontend `ProductDetail`: "Buat Versi Baru" button (Admin only), Parent/Source/Version Group info card with link to parent
- Frontend `Products` list: new Versioning column with Original / Clone / Latest / N-versi badges grouped by `version_group`
- Backend tests: 51/51 (12 new P2A tests)

## Phase P2B (v1.3, Feb 2026) — Product Version Diff / Compare
- `GET /api/products/{sku}/compare/{source_sku}` (all roles) returns structured diff with `summary` (per section) + 6 section diffs (recipe/bundles/work_instructions/pin_map/qc_template/common_mistakes)
- Each row labeled `added | removed | changed | unchanged` with field-level change list
- Smart synthesis: recipe membership changes per bundle (`cables_in_bundle`); nested `pin_diff` per relay; nested `step_diff` per work instruction bundle
- Keys: cable_code (recipe), bundle_code (bundles + WI), relay_number (pin map), nama (QC items, stable across clones), kesalahan text (mistakes)
- Frontend page `/products/{sku}/compare/{source_sku}` with summary card showing Indonesian "X perubahan recipe, Y perubahan bundle…", 6 tab sections, side-by-side field diff with strikethrough+arrow, status chips (Ditambahkan/Dihapus/Diubah/Tidak berubah), source product selector, browser print
- Frontend ProductDetail: "Bandingkan dengan Produk Asal" button (visible when parent_sku or source_sku present, all roles)
- Backend tests: 61/61 (10 new P2B tests including self-compare, 404, all sections, role access)
- Rename: app renamed from "Production OS" to "Production System" (browser title, sidebar, login, print views, docstrings, PRD)

## Phase P2C (v1.4, Feb 2026) — Auto-Generated Production Briefing on Work Orders
- New helper `_build_briefing_from_diff()` condenses compare-diff into Bahasa Indonesia briefing snapshot: `summary_text`, `important_changes[]`, `compared_to_sku`, `compare_url`, `changed_sections[]`, plus row-key arrays (`changed_recipe_codes`, `removed_recipe_codes`, `added_recipe_codes`, `changed_bundle_codes`, `changed_wi_bundles`, `changed_pin_relays`, `changed_qc_items`).
- `POST /api/work-orders` auto-attaches briefing if product has `parent_sku` or `source_sku`; snapshot is denormalized into the WO doc so later product edits don't retroactively alter past WOs.
- `POST /api/work-orders/{wo}/regenerate-briefing` (Admin/Production) rebuilds the briefing from current product state.
- Frontend component `/app/frontend/src/components/ProductionBriefing.jsx` exports `<ProductionBriefing>` (full + compact), `<ChangedBadge>`, `cableChangeKind`, `bundleChangeKind`.
- Briefing card surfaces on: `WorkOrderDetail` (full), `BundleDetail` (compact + bundle-level notice), `print/CuttingSheetPrint` (full); row-level `Berubah/Baru/Dihapus` badges on cutting-sheet rows (screen + print), bundle cards, bundle-labels print, and BundleDetail cable list.
- Backend tests: 69/69 (8 new TestP2CBriefing tests: cloned-WO attach, root-WO no briefing, GET returns briefing, regenerate after mutation, regenerate root returns none, QC role 403, 404, cleanup).
- Frontend E2E: 100% via testing_agent (iteration_7).

## Phase P3A (v1.5, Feb 2026) — Reference Photo Uploads (Object Storage)
- New backend module `storage.py` integrates Emergent Object Storage (init at startup, automatic 403 re-init, JPG/PNG/WEBP whitelist, 5 MB cap). Storage paths follow `relaylab/uploads/{related_type}/{uuid}.{ext}`.
- New `FileAsset` model + collection `file_assets`. DB stores only metadata (storage_path, file_url, mime_type, size, related_type, related_id, product_sku, caption, uploaded_by, uploaded_at, is_deleted). **No base64 in DB.**
- `routes_uploads.py` endpoints (all under `/api`):
  - `POST /uploads` (multipart) — Admin all types, QC only `qc_evidence`, Production blocked.
  - `GET /files/{id}` — public (no auth) so `<img src>` works directly; bytes streamed from object storage with `Cache-Control: public, max-age=3600`.
  - `PATCH /files/{id}` — Admin all, QC qc_evidence only — caption/notes.
  - `DELETE /files/{id}` — Admin all, QC qc_evidence only (soft-delete via `is_deleted`).
  - `GET /files?related_type=&related_id=` — list.
  - `POST /files/bulk-by-related` — batch fetch grouped by related_id.
- Frontend `ImageUploader.jsx` (with named `ImageGalleryReadOnly`): client-side MIME+size validation w/ sonner toasts, drag-hover action buttons (view/replace/caption/delete), lightbox modal, caption editor. Stable test-id contract `{prefix}-root|-upload-btn|-item-{id}|-thumb-{id}|-view-{id}|-replace-{id}|-caption-{id}|-delete-{id}|-empty`.
- Integrated into 4 surfaces:
  - **Bundle photos** (related_id=bundle.id): BundleEditor (admin) + ProductDetail Bundle tab (display) + BundleDetail QR page (display).
  - **Work Instruction Step photos** (related_id=`{sku}:{bundle}:{step}`): WorkInstructionEditor (admin) + BundleDetail steps (display + legacy `foto_url` fallback `<img>`).
  - **Common Mistake photos** (related_id=mistake.id): ProductDetail Mistakes tab with admin-only `<details>` "Kelola Foto" section + BundleDetail mistake cards (display).
  - **QC Fail Evidence** (related_id=`{wo_number}:{item_id}`): WorkOrderDetail QcPanel — inline row appears only when item.pass_fail === "Fail"; Admin/QC can upload; foto tetap di DB saat switch back to Pass.
- Backward compat: existing `foto_url` fields on bundle/step/mistake/qc_result_item preserved & still displayed (BundleDetail step section renders legacy URL via `<img onError>` graceful fallback).
- RBAC matrix: Admin = upload/edit/delete all; QC = upload+edit+delete qc_evidence only; Production = read-only on everything.
- Backend tests: 86/86 (17 new TestP3AUploads: upload OK, list, public download, patch caption, bulk, RBAC for Admin/QC/Production, bad MIME 415, bad related_type 400, oversized 413, qc cannot delete bundle photo, qc can delete own qc evidence, admin delete, unauth 401, 404).
- Frontend E2E: 100% (10/10 review items GREEN in iteration_8).
- Files: `/app/backend/storage.py`, `/app/backend/routes_uploads.py`, `/app/frontend/src/components/ImageUploader.jsx`.

## Backlog (P1)
- Foto upload for bundles/instructions/mistakes (object storage) — **DONE in Phase P3A (v1.5)**
- Edit UI for product recipe/bundles/work-instructions/pin-map — **DONE in Phase P1**
- Export PDF (currently browser print only)
- Multi-page navigation for printable bundle labels (one-per-page mode)

## Backlog (P2)
- Export to PDF (true PDF generator, not just browser print)
- Inventory / stock substitution suggestions
- Reseller portal / order ingestion
- Skill-based WO assignment (use Training Matrix)
- WO progress events log / audit trail
- Tablet/desktop UX polish (touch-friendly buttons, horizontal-scroll tables, mobile-friendly Bundle Detail QR)
- Refactor `/app/backend/routes.py` (~1330 lines) into per-domain modules
- Sweeper job to hard-delete object storage objects whose FileAsset is `is_deleted=true` AND not referenced by any active FileAsset (shared storage_path safety)
- Per-product file listing endpoint (GET /api/files?product_sku=…) for audit/cleanup

## Explicitly Dropped (was on roadmap, removed Feb 2026)
- **PWA / Offline / Service Worker** — Internal app used purely via desktop and tablet browsers on the workshop floor. No installable PWA, no offline cache, no sync. Use browser-based responsive UX instead.

## Phase P3A-bis (v1.6, Feb 2026) — "Salin Foto Referensi" on Clone
- Clone dialog adds checkbox **Salin Foto Referensi** (default ON, alongside other 6 copy toggles).- Clone endpoint extension: when `copy_photos=true` AND the relevant section was also copied (bundles / WI / mistakes), backend creates new `FileAsset` metadata rows for bundle / work_instruction_step / common_mistake photos. **No physical re-upload.** Each clone:
  - Gets a fresh `id` (uuid) and `file_url = /api/files/{new_id}`.
  - **Reuses the source `storage_path`** (same image bytes served from one storage object) — safe because storage is reference-only; soft-delete on clone never removes the object.
  - Replaces `related_id` via `bundle_id_map[old]→new`, `mistake_id_map[old]→new`, or step-prefix swap (`{src_sku}:` → `{new_sku}:`).
  - Initial caption/notes copied; tracked via `source_file_id` for provenance.
  - `product_sku` = new SKU (also auto-derived by upload endpoint now, for /api/uploads parity).
- **QC fail evidence (`qc_evidence`) is NEVER copied** — by design, evidence belongs to a specific WO.
- Revision history entry added: `"Foto Referensi" — "Foto referensi disalin dari {src} ({N} foto)"`.
- Independence guarantees:
  - **Delete on clone** = soft-delete only (`is_deleted=true`); source FileAsset and storage object unchanged.
  - **Replace on clone** = uploader creates a brand-new storage object via POST /uploads; source's `storage_path` untouched.
  - **Caption/notes edit on clone** = scoped to the clone's `id` only; source unaffected.
- Backend tests: 96/96 (10 new TestP3APhotoClone tests).
- Frontend E2E: 100% via testing_agent iteration_9.
- Files: `/app/backend/models.py` (FileAsset.source_file_id, CloneProductInput.copy_photos), `/app/backend/routes.py` (clone block), `/app/backend/routes_uploads.py` (auto-derive product_sku), `/app/frontend/src/components/CloneProductDialog.jsx`.

## Key Files
- `/app/backend/server.py` — FastAPI bootstrap, indexes, seed trigger
- `/app/backend/models.py` — Pydantic models for 15 collections
- `/app/backend/routes.py` — All `/api/*` endpoints (auth, products, cable-functions, machine-programs, work-orders, batch-colors, qc, training)
- `/app/backend/auth.py` — Session-cookie helpers (bcrypt, get_current_user, require_roles)
- `/app/backend/seed_data.py` — Initial Foglamp AOD seed
- `/app/frontend/src/App.js` — Router with protected/public routes
- `/app/frontend/src/components/Layout.jsx` — Sidebar + topbar + change-password
- `/app/frontend/src/pages/*` — Page components
- `/app/frontend/src/pages/print/*` — Print-friendly pages
- `/app/frontend/src/pages/operator/*` — Fullscreen dark Operator View (Phase P3B)

## Phase P3C (v1.8, Feb 2026) — Cutting Sheet Sort untuk Efisiensi Potong Kabel
- Backend `GET /api/work-orders/{wo}/cutting-sheet` rows sekarang di-sort:
  1. **Ukuran kabel** (natural-numeric: `0.5mm < 0.85mm < 1.5mm < 2mm`) — operator tidak ganti program mesin
  2. **Warna aktual** (case-insensitive, fallback ke warna_default) — minim ganti spool dalam satu ukuran
  3. **Cable code** — stable tiebreaker
- Sort otomatis ter-reflow saat operator input substitusi warna via `POST /batch-colors` (warna_aktual berubah → posisi berubah).
- Frontend WorkOrderDetail Cutting tab: separator row `── ukuran X.Xmm ──` antar grup ukuran; ukuran/warna di-bold ketika berbeda dari baris sebelumnya (sisanya abu-abu).
- Frontend CuttingSheetPrint: separator border tebal antar ukuran, ukuran/warna bold pada baris pertama tiap grup, header hint "Urutan baris: ukuran → warna → cable code".
- Backend tests: 110/110 GREEN (4 new TestCuttingSheetSort: ukuran ascending, within-ukuran warna order, within-warna code order, substitusi reflow).

## Phase P3B (v1.7, Feb 2026) — Operator View untuk Tablet/Desktop Produksi
- Two new browser routes (no Layout wrapper, dark fullscreen):
  - `/operator/work-orders/:woNumber` — WO summary + bundle cards w/ progress badges
  - `/operator/work-orders/:woNumber/bundles/:bundleCode` — distraction-free bundle ops page
- Backend:
  - New `OperatorProgress` model + `operator_progress` collection with unique index `(wo_number, bundle_code, step_number)`.
  - `GET /api/work-orders/{wo}/operator-progress` (any role) → `{wo_number, items[], summary[{bundle_code, bundle_name, total_steps, checked_steps, completed}]}`. Total steps derived from `work_instructions[bundle_code].steps`.
  - `POST /api/work-orders/{wo}/operator-progress` (Admin/Production) upserts `{bundle_code, step_number, checked}` and records `checked_by` + `checked_at` on check, clears them on uncheck.
- Frontend:
  - `OperatorWorkOrder.jsx` — WO header (huge WO number, qty), Production Briefing if present, bundle card grid with per-bundle progress bar + Selesai badge.
  - `OperatorBundle.jsx` — 6xl bundle code, target relay pin, sticky top bar, cable list as cards (no horizontal scroll), Work Instruction steps as big cards with 56×56 checkbox buttons (CheckCircle2 when checked), Common Mistakes block, Prev/Next bundle nav, full-screen photo lightbox.
  - `OperatorPhotoGallery` component: bigger thumbs (h-32/h-40), click → fixed z-50 dark lightbox, click anywhere closes.
  - Production Briefing & ChangedBadge integrated (operator sees changed cables/bundles too).
  - "Mode Operator" entry buttons added on `WorkOrderDetail` (`data-testid=wo-open-operator-mode`) and `BundleDetail` (`bundle-open-operator-mode`).
  - QC role sees the operator view in read-only mode (`aria-disabled`, "Hanya lihat" badge); GET endpoint allowed, POST 403.
- Tablet/Desktop UX: minimum 48–56px touch targets, no horizontal scroll on operator pages, text-lg/xl headings, large checkbox buttons.
- Backend tests: 106/106 GREEN (10 new TestP3BOperatorProgress: empty-initial, check updates summary, all-checked → completed=true, uncheck clears metadata, idempotent upsert, QC read-only, unauth 401, WO 404, isolation across WOs).
- Frontend E2E: 100% via testing_agent (iteration_10) — all 13 review scenarios GREEN.
- Files: `/app/backend/models.py` (OperatorProgress), `/app/backend/routes.py` (GET/POST endpoints), `/app/backend/server.py` (index), `/app/frontend/src/App.js` (routes), `/app/frontend/src/pages/operator/OperatorWorkOrder.jsx`, `/app/frontend/src/pages/operator/OperatorBundle.jsx`, plus entry buttons in `WorkOrderDetail.jsx` / `BundleDetail.jsx`.


## Bahasa
All UI labels in Bahasa Indonesia (e.g., Perintah Kerja, Master Kabel, Program Mesin, Cetak, Simpan, Hapus).
