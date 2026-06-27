import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCompareArrows, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { fmtDateTime } from "@/lib/utils-app";

/**
 * Production Briefing card for Work Order context.
 * Shows when a WO is for a product cloned/derived from another SKU.
 *
 * Props:
 *  - briefing: object from WO.briefing (may be null/undefined)
 *  - sku: current product SKU
 *  - compact: smaller inline variant (for Bundle Detail header)
 */
export default function ProductionBriefing({ briefing, sku, compact = false }) {
  if (!briefing) return null;

  if (compact) {
    return (
      <div data-testid="briefing-compact" className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold">Catatan Produk: </span>{briefing.summary_text?.replace(/^Catatan Produk: ?/, "")}
        </div>
      </div>
    );
  }

  return (
    <section data-testid="briefing-card" className="bg-amber-50 border-2 border-amber-200 rounded-md p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-amber-100 border border-amber-300 grid place-items-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">Production Briefing</h3>
            <Badge variant="outline" className="text-xs bg-white">
              vs <span className="font-mono ml-1">{briefing.compared_to_sku}</span>
            </Badge>
          </div>
          <p data-testid="briefing-summary-text" className="text-sm text-slate-800 leading-relaxed mb-3">
            {briefing.summary_text}
          </p>

          {briefing.important_changes && briefing.important_changes.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">Perubahan Penting</div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                {briefing.important_changes.slice(0, 8).map((c, i) => (
                  <li key={i} data-testid={`briefing-change-${i}`} className="flex items-start gap-1.5">
                    <span className="text-amber-600">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              {briefing.important_changes.length > 8 && (
                <div className="text-xs text-slate-500 mt-1">…dan {briefing.important_changes.length - 8} lainnya</div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-amber-200">
            <div className="text-xs text-slate-500">
              Snapshot dibuat: {fmtDateTime(briefing.generated_at)}
            </div>
            <Link to={`/products/${sku}/compare/${briefing.compared_to_sku}`} className="no-print">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" data-testid="briefing-compare-btn">
                <GitCompareArrows className="w-3 h-3 mr-1" />Lihat Detail Perbandingan
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Small "Berubah dari versi sebelumnya" badge for individual rows. */
export function ChangedBadge({ kind, className = "" }) {
  const label = kind === "added" ? "Baru" : kind === "removed" ? "Dihapus" : "Berubah";
  const cls = kind === "added"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : kind === "removed"
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <Badge data-testid={`changed-badge-${kind}`} variant="outline" className={`text-xs ${cls} ${className}`}>
      {label}
    </Badge>
  );
}

/** Hint helper: returns "added" | "removed" | "changed" | null for a cable_code. */
export function cableChangeKind(briefing, cableCode) {
  if (!briefing) return null;
  if (briefing.added_recipe_codes?.includes(cableCode)) return "added";
  if (briefing.removed_recipe_codes?.includes(cableCode)) return "removed";
  if (briefing.changed_recipe_codes?.includes(cableCode)) return "changed";
  return null;
}

export function bundleChangeKind(briefing, bundleCode) {
  if (!briefing) return null;
  if (briefing.changed_bundle_codes?.includes(bundleCode)) return "changed";
  return null;
}
