# RelayLab Production OS — PRD

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

## Backlog (P1)
- Foto upload for bundles/instructions/mistakes (object storage)
- Edit UI for product recipe/bundles/work-instructions/pin-map (currently CRUD by JSON; structure is editable but UI forms not yet built)
- Export PDF (currently browser print only)
- Multi-page navigation for printable bundle labels (one-per-page mode)

## Backlog (P2)
- Inventory / stock substitution suggestions
- Reseller portal / order ingestion
- Skill-based WO assignment (use Training Matrix)
- WO progress events log / audit trail

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

## Bahasa
All UI labels in Bahasa Indonesia (e.g., Perintah Kerja, Master Kabel, Program Mesin, Cetak, Simpan, Hapus).
