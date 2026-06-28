import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAuth, hasRole } from "@/lib/auth";
import {
  ArrowLeft, ArrowRight, AlertTriangle, Plug, ChevronLeft, ChevronRight, CheckCircle2,
} from "lucide-react";
import ProductionBriefing, { ChangedBadge, cableChangeKind, bundleChangeKind } from "@/components/ProductionBriefing";
import { ImageGalleryReadOnly } from "@/components/ImageUploader";
import { toast } from "sonner";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

function fullUrl(p) {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `${BACKEND}${p}`;
}

export default function OperatorBundle() {
  const { woNumber, bundleCode } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const canCheck = hasRole(user, "Admin", "Production");

  const [data, setData] = useState(null);
  const [progress, setProgress] = useState({}); // {step_number: bool}
  const [progressSummary, setProgressSummary] = useState([]);
  const [busy, setBusy] = useState({});

  const loadAll = useCallback(async () => {
    const [d, p] = await Promise.all([
      api.get(`/work-orders/${woNumber}/bundles/${bundleCode}`),
      api.get(`/work-orders/${woNumber}/operator-progress`),
    ]);
    setData(d.data);
    const map = {};
    (p.data.items || []).forEach((it) => {
      if (it.bundle_code === bundleCode) map[it.step_number] = !!it.checked;
    });
    setProgress(map);
    setProgressSummary(p.data.summary || []);
  }, [woNumber, bundleCode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleStep = async (stepNum, current) => {
    if (!canCheck) return;
    const next = !current;
    setProgress((m) => ({ ...m, [stepNum]: next }));
    setBusy((b) => ({ ...b, [stepNum]: true }));
    try {
      await api.post(`/work-orders/${woNumber}/operator-progress`, {
        bundle_code: bundleCode,
        step_number: stepNum,
        checked: next,
      });
      // Refresh summary so progress bar updates
      const p = await api.get(`/work-orders/${woNumber}/operator-progress`);
      setProgressSummary(p.data.summary || []);
      if (next) toast.success(`Step ${stepNum} selesai`);
    } catch (e) {
      setProgress((m) => ({ ...m, [stepNum]: current })); // revert
      toast.error(e?.response?.data?.detail || "Gagal simpan progress");
    } finally {
      setBusy((b) => ({ ...b, [stepNum]: false }));
    }
  };

  if (!data) return <div className="min-h-screen grid place-items-center bg-slate-900 text-amber-300 text-2xl">Memuat...</div>;
  const { wo, product, bundle, cables, work_instruction, common_mistakes, prev_bundle, next_bundle } = data;
  const briefing = wo.briefing;
  const bundleChanged = bundleChangeKind(briefing, bundle.bundle_code);
  const steps = work_instruction?.steps || [];
  const total = steps.length;
  const checkedCount = steps.filter((s) => progress[s.step_number]).length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const completed = total > 0 && checkedCount >= total;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-24" data-testid="operator-bundle-root">
      {/* Top bar */}
      <div className="bg-slate-950 border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => nav(`/operator/work-orders/${woNumber}`)}
            className="border-slate-600 text-slate-200 hover:bg-slate-800 h-10"
            data-testid="operator-back-wo"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Semua Bundle
          </Button>
          <Link to={`/work-orders/${woNumber}/bundles/${bundleCode}`} className="text-slate-400 hover:text-amber-300 text-xs underline">
            Tampilan normal
          </Link>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div className="font-mono text-amber-300 font-bold">{wo.wo_number}</div>
          <div>{wo.qty} set · {wo.reseller}</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Bundle header */}
        <div className="bg-slate-800 rounded-xl p-5 mb-5 border border-slate-700">
          <div className="flex items-baseline gap-4 flex-wrap">
            <div className="text-6xl sm:text-7xl font-black font-mono text-amber-300">{bundle.bundle_code}</div>
            <div className="flex-1 min-w-[200px]">
              <div className="text-2xl sm:text-3xl font-bold text-slate-100">{bundle.bundle_name}</div>
              <div className="text-slate-400 mt-1">{bundle.fungsi_bundle}</div>
            </div>
            {completed && (
              <Badge className="bg-emerald-500 text-white text-base px-3 py-1" data-testid="operator-bundle-complete">
                <CheckCircle2 className="w-4 h-4 mr-1" /> SELESAI
              </Badge>
            )}
          </div>
          {bundle.target_relay_pin && (
            <div className="mt-3 text-amber-300 flex items-center gap-2 text-base">
              <Plug className="w-4 h-4" /> Target Pin: <span className="font-mono font-bold">{bundle.target_relay_pin}</span>
            </div>
          )}
          {total > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <Progress value={pct} className="flex-1 h-3 bg-slate-700" data-testid="operator-progress-bar" />
              <div className="font-mono font-bold text-amber-300 text-lg" data-testid="operator-progress-text">{checkedCount}/{total}</div>
            </div>
          )}
        </div>

        {/* Briefing if bundle changed */}
        {bundleChanged && briefing && (
          <div className="bg-amber-900/30 border-2 border-amber-500 rounded-xl p-4 mb-5" data-testid="operator-bundle-changed">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-300 flex-shrink-0" />
              <div>
                <div className="text-amber-200 font-bold text-lg">Bundle ini BERBEDA dari versi asal ({briefing.compared_to_sku}).</div>
                <div className="text-amber-100/90 text-sm mt-1">Periksa daftar kabel & instruksi di bawah. Jangan andalkan kebiasaan dari versi lama.</div>
              </div>
            </div>
          </div>
        )}

        {/* Bundle reference photos */}
        <div className="mb-6">
          <div className="text-sm uppercase tracking-wide text-slate-400 mb-2 font-semibold">Foto Referensi Bundle</div>
          <OperatorPhotoGallery relatedType="bundle" relatedId={bundle.id} testIdPrefix="operator-bundle-photo" />
        </div>

        {/* Cable list */}
        <div className="bg-slate-800 rounded-xl p-5 mb-6 border border-slate-700">
          <div className="text-sm uppercase tracking-wide text-slate-400 mb-3 font-semibold">Daftar Kabel ({cables.length})</div>
          <div className="space-y-2">
            {cables.map((c) => {
              const ck = cableChangeKind(briefing, c.cable_code);
              return (
                <div
                  key={c.cable_code}
                  className={`flex items-baseline gap-3 p-3 rounded-lg ${ck ? "bg-amber-950/30 border-l-4 border-amber-500" : "bg-slate-700/40"}`}
                  data-testid={`operator-cable-${c.cable_code}`}
                >
                  <div className="font-mono font-bold text-amber-300 text-lg w-28 flex-shrink-0">{c.cable_code}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100 font-medium truncate">{c.nama_fungsi}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span className="font-mono">{c.ukuran_kabel}</span> · <span className="font-mono">{c.panjang_cm} cm</span>
                      {c.warna && <> · <span>warna: <strong className="text-slate-200">{c.warna}</strong></span></>}
                    </div>
                  </div>
                  <div className="text-right text-amber-300 font-mono font-bold">×{c.total_qty}</div>
                  {ck && <ChangedBadge kind={ck} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-slate-800 rounded-xl p-5 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm uppercase tracking-wide text-slate-400 font-semibold">Work Instruction</div>
            {!canCheck && <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">Hanya lihat</Badge>}
          </div>
          {steps.length === 0 ? (
            <div className="text-slate-500 italic">Belum ada instruksi.</div>
          ) : (
            <div className="space-y-3">
              {steps.map((s) => {
                const isChecked = !!progress[s.step_number];
                return (
                  <div
                    key={s.step_number}
                    className={`rounded-xl border-2 p-4 transition-all ${
                      isChecked
                        ? "bg-emerald-900/20 border-emerald-600/50"
                        : "bg-slate-700/30 border-slate-600"
                    }`}
                    data-testid={`operator-step-${s.step_number}`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        type="button"
                        onClick={() => toggleStep(s.step_number, isChecked)}
                        disabled={!canCheck || busy[s.step_number]}
                        aria-disabled={!canCheck}
                        aria-pressed={isChecked}
                        className={`flex-shrink-0 w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-colors ${
                          isChecked
                            ? "bg-emerald-500 border-emerald-400"
                            : "bg-slate-800 border-slate-500 hover:border-amber-500"
                        } ${!canCheck ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        data-testid={`operator-step-check-${s.step_number}`}
                        aria-label={isChecked ? "Tandai belum selesai" : "Tandai selesai"}
                      >
                        {isChecked ? (
                          <CheckCircle2 className="w-8 h-8 text-white" />
                        ) : (
                          <span className="text-2xl font-bold text-slate-300">{s.step_number}</span>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-lg sm:text-xl font-semibold leading-snug ${isChecked ? "line-through text-slate-400" : "text-slate-100"}`}>
                          {s.instruksi}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                          {s.komponen && <div className="text-slate-300"><span className="text-slate-500">Komponen:</span> <span className="font-mono">{s.komponen}</span></div>}
                          {s.tools && <div className="text-slate-300"><span className="text-slate-500">Tools:</span> {s.tools}</div>}
                          {s.safety && <div className="col-span-full text-amber-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{s.safety}</div>}
                          {s.common_mistake && <div className="col-span-full text-red-300">⚠ {s.common_mistake}</div>}
                        </div>
                        <div className="mt-3">
                          <OperatorPhotoGallery
                            relatedType="work_instruction_step"
                            relatedId={`${wo.product_sku}:${bundleCode}:${s.step_number}`}
                            testIdPrefix={`operator-step-photo-${s.step_number}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Common Mistakes */}
        {common_mistakes && common_mistakes.length > 0 && (
          <div className="bg-red-950/20 border-2 border-red-700/50 rounded-xl p-5 mb-6">
            <div className="text-sm uppercase tracking-wide text-red-300 font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Hati-hati ({common_mistakes.length} kesalahan umum)
            </div>
            <div className="space-y-3">
              {common_mistakes.map((m) => (
                <div key={m.id} className="bg-slate-800/60 rounded-lg p-3" data-testid={`operator-mistake-${m.id}`}>
                  <div className="font-semibold text-red-200">{m.kesalahan}</div>
                  <div className="text-sm text-slate-300 mt-1"><span className="text-slate-500">Akibat:</span> {m.akibat}</div>
                  <div className="text-sm text-emerald-300 mt-0.5"><span className="text-slate-500">Cegah:</span> {m.cara_mencegah}</div>
                  <div className="mt-2">
                    <OperatorPhotoGallery
                      relatedType="common_mistake"
                      relatedId={m.id}
                      testIdPrefix={`operator-mistake-photo-${m.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between gap-3 mt-8">
          <Button
            variant="outline"
            disabled={!prev_bundle}
            onClick={() => prev_bundle && nav(`/operator/work-orders/${woNumber}/bundles/${prev_bundle}`)}
            className="h-14 px-6 border-slate-600 text-slate-100 hover:bg-slate-800 disabled:opacity-30"
            data-testid="operator-prev-bundle"
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> Bundle Sebelumnya
          </Button>
          <Button
            variant="outline"
            disabled={!next_bundle}
            onClick={() => next_bundle && nav(`/operator/work-orders/${woNumber}/bundles/${next_bundle}`)}
            className="h-14 px-6 border-slate-600 text-slate-100 hover:bg-slate-800 disabled:opacity-30"
            data-testid="operator-next-bundle"
          >
            Bundle Berikutnya <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Larger photo gallery tuned for operator view (big thumbs, full-screen lightbox). */
function OperatorPhotoGallery({ relatedType, relatedId, testIdPrefix }) {
  const [files, setFiles] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get(`/files`, { params: { related_type: relatedType, related_id: relatedId } })
      .then((r) => { if (alive) setFiles(r.data || []); })
      .catch(() => { if (alive) setFiles([]); });
    return () => { alive = false; };
  }, [relatedType, relatedId]);

  if (files.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid={`${testIdPrefix}-root`}>
        {files.map((f) => (
          <button
            type="button"
            key={f.id}
            onClick={() => setOpen(f)}
            className="block border border-slate-600 rounded-lg overflow-hidden bg-slate-900 hover:border-amber-500"
            data-testid={`${testIdPrefix}-thumb-${f.id}`}
          >
            <img src={fullUrl(f.file_url)} alt={f.caption || ""} className="w-full h-32 sm:h-40 object-cover" loading="lazy" />
            {f.caption && <div className="text-xs text-slate-300 px-2 py-1 truncate bg-slate-800/80">{f.caption}</div>}
          </button>
        ))}
      </div>
      {open && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
          data-testid={`${testIdPrefix}-lightbox`}
        >
          <img src={fullUrl(open.file_url)} alt={open.caption || ""} className="max-w-full max-h-[85vh] object-contain" />
          {open.caption && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 text-slate-100 px-4 py-2 rounded-lg text-sm">{open.caption}</div>}
        </div>
      )}
    </>
  );
}
