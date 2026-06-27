import React from "react";

export function StatusBadge({ status, className = "" }) {
  const map = {
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
    "Normal": "badge-draft",
    "Urgent": "badge-fail",
  };
  const cls = map[status] || "badge-draft";
  return (
    <span
      data-testid={`status-badge-${status?.toLowerCase().replace(/\s+/g, "-")}`}
      className={`inline-flex items-center text-xs font-semibold border px-2.5 py-0.5 rounded-full ${cls} ${className}`}
    >
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6 no-print">
      <div>
        <h1 data-testid={testid || "page-title"} className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = "" }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-md shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          {title && <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}
