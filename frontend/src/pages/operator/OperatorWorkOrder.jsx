import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth, hasRole } from "@/lib/auth";
import { ArrowRight, ArrowLeft, LogOut, CheckCircle2, Circle } from "lucide-react";
import ProductionBriefing from "@/components/ProductionBriefing";

export default function OperatorWorkOrder() {
  const { woNumber } = useParams();
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [wo, setWo] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [woR, bunR, progR] = await Promise.all([
        api.get(`/work-orders/${woNumber}`),
        api.get(`/work-orders/${woNumber}/bundles`),
        api.get(`/work-orders/${woNumber}/operator-progress`),
      ]);
      setWo(woR.data);
      setBundles(bunR.data.bundles || []);
      setProgress(progR.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [woNumber]);

  const summaryByBundle = useMemo(() => {
    const m = {};
    (progress?.summary || []).forEach((s) => { m[s.bundle_code] = s; });
    return m;
  }, [progress]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-slate-900 text-amber-300 text-2xl">Memuat...</div>;
  if (!wo) return <div className="min-h-screen grid place-items-center bg-slate-900 text-red-300 text-xl">WO tidak ditemukan</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8" data-testid="operator-wo-root">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-slate-900 font-bold rounded-lg px-3 py-2 text-lg" data-testid="operator-mode-badge">MODE OPERATOR</div>
          <Link to={`/work-orders/${woNumber}`} className="text-slate-400 hover:text-amber-300 text-sm underline" data-testid="operator-exit-link">
            Kembali ke tampilan normal
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">{user?.name} ({user?.role})</span>
          <Button variant="outline" size="sm" onClick={logout} className="border-slate-600 text-slate-200 hover:bg-slate-800" data-testid="operator-logout">
            <LogOut className="w-4 h-4 mr-1" /> Keluar
          </Button>
        </div>
      </div>

      {/* WO header */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700" data-testid="operator-wo-header">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Work Order</div>
            <div className="text-4xl sm:text-5xl font-bold text-amber-300 font-mono" data-testid="operator-wo-number">{wo.wo_number}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400">Status</div>
            <Badge className="text-lg px-3 py-1 mt-1 bg-amber-500 text-slate-900">{wo.status}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-base sm:text-lg">
          <div>
            <div className="text-xs uppercase text-slate-400">Reseller</div>
            <div className="font-semibold text-slate-100">{wo.reseller}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">SKU</div>
            <div className="font-mono text-slate-100">{wo.product_sku}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Qty</div>
            <div className="font-bold text-2xl text-amber-300">{wo.qty} <span className="text-sm text-slate-400">set</span></div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Prioritas</div>
            <div>{wo.prioritas}</div>
          </div>
        </div>
      </div>

      {/* Production Briefing */}
      {wo.briefing && (
        <div className="mb-6">
          <ProductionBriefing briefing={wo.briefing} sku={wo.product_sku} />
        </div>
      )}

      {/* Bundle cards */}
      <div className="space-y-1 mb-3 text-xs uppercase tracking-wider text-slate-400">Pilih Bundle</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundles.map((b) => {
          const summary = summaryByBundle[b.bundle_code];
          const total = summary?.total_steps || 0;
          const checked = summary?.checked_steps || 0;
          const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
          const completed = summary?.completed;
          return (
            <button
              key={b.bundle_code}
              data-testid={`operator-bundle-card-${b.bundle_code}`}
              onClick={() => nav(`/operator/work-orders/${woNumber}/bundles/${b.bundle_code}`)}
              className={`text-left rounded-xl border-2 p-5 transition-all hover:scale-[1.02] active:scale-100 ${
                completed
                  ? "bg-emerald-900/30 border-emerald-500"
                  : checked > 0
                    ? "bg-slate-800 border-amber-500"
                    : "bg-slate-800 border-slate-700 hover:border-amber-500"
              }`}
            >
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-5xl font-black font-mono text-amber-300">{b.bundle_code}</div>
                {completed ? (
                  <Badge className="bg-emerald-500 text-white text-sm px-3 py-1" data-testid={`operator-bundle-done-${b.bundle_code}`}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Selesai
                  </Badge>
                ) : checked > 0 ? (
                  <Badge className="bg-amber-500 text-slate-900 text-sm px-3 py-1">{checked}/{total} step</Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-600 text-slate-400 text-sm">Belum mulai</Badge>
                )}
              </div>
              <div className="text-xl font-semibold text-slate-100 mb-3">{b.bundle_name}</div>
              <div className="text-sm text-slate-400 mb-3">{b.fungsi_bundle}</div>
              {total > 0 && (
                <Progress value={pct} className="h-2 bg-slate-700" data-testid={`operator-bundle-progress-${b.bundle_code}`} />
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{b.cables?.length || 0} kabel</span>
                <span className="flex items-center gap-1 text-amber-300 font-semibold">Buka <ArrowRight className="w-3 h-3" /></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
