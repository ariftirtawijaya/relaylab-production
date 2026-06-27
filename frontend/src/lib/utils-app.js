// Status badge helper
export function statusClass(status) {
  const m = {
    "Draft": "badge-draft",
    "Trial": "badge-trial",
    "Released": "badge-released",
    "Hold": "badge-hold",
    "Deprecated": "badge-deprecated",
    "Menunggu Cutting": "badge-cutting",
    "Cutting Berjalan": "badge-cutting",
    "Cutting Selesai": "badge-cutting",
    "Produksi Berjalan": "badge-produksi",
    "Menunggu QC": "badge-qc",
    "QC Berjalan": "badge-qc",
    "QC Pass": "badge-pass",
    "Rework": "badge-fail",
    "Packing": "badge-produksi",
    "Done": "badge-done",
    "Cancelled": "badge-deprecated",
    "Pass": "badge-pass",
    "Fail": "badge-fail",
    "Pending": "badge-qc",
  };
  return m[status] || "badge-draft";
}

export function fmtDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function fmtDateTime(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export const WO_STATUSES = [
  "Draft", "Menunggu Cutting", "Cutting Berjalan", "Cutting Selesai",
  "Produksi Berjalan", "Menunggu QC", "QC Berjalan", "QC Pass",
  "Rework", "Packing", "Done", "Cancelled",
];

export const PRODUCT_STATUSES = ["Draft", "Trial", "Released", "Hold", "Deprecated"];

export const CABLE_CATEGORIES = ["Power", "Ground", "Trigger", "Output", "Jumper", "Input"];

export const SKILL_LEVELS = [
  "Belum training", "Training", "Bisa dengan pengawasan", "Bisa mandiri", "Trainer",
];
