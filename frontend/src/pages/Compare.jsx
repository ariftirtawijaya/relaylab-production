import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Printer, Plus, Minus, RefreshCw, Check, GitBranch,
} from "lucide-react";

const STATUS_STYLE = {
  added: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Ditambahkan", icon: Plus },
  removed: { cls: "bg-red-50 text-red-800 border-red-200", label: "Dihapus", icon: Minus },
  changed: { cls: "bg-amber-50 text-amber-800 border-amber-200", label: "Diubah", icon: RefreshCw },
  unchanged: { cls: "bg-slate-50 text-slate-600 border-slate-200", label: "Tidak berubah", icon: Check },
};

function StatusChip({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.unchanged;
  const Icon = s.icon;
  return (
    <span data-testid={`chip-${status}`} className={`inline-flex items-center gap-1 text-xs font-semibold border px-2 py-0.5 rounded-full ${s.cls}`}>
      <Icon className="w-3 h-3" />{s.label}
    </span>
  );
}

function SummaryCard({ label, summary, testid }) {
  const total = summary.added + summary.removed + summary.changed;
  return (
    <div data-testid={testid} className="bg-white border border-slate-200 rounded-md p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-bold mono text-slate-900">{total}</div>
        <div className="text-xs text-slate-500">perubahan</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {summary.added > 0 && <span className="text-emerald-700">+{summary.added} baru</span>}
        {summary.removed > 0 && <span className="text-red-700">-{summary.removed} hapus</span>}
        {summary.changed > 0 && <span className="text-amber-700">~{summary.changed} ubah</span>}
        {total === 0 && <span className="text-slate-400">Tidak ada perubahan</span>}
      </div>
    </div>
  );
}

function FieldDiff({ field, current, source }) {
  return (
    <div className="text-xs">
      <span className="text-slate-500 mr-1">{field}:</span>
      <span className="line-through text-red-600 mono">{String(source ?? "—")}</span>
      <span className="mx-1">→</span>
      <span className="text-emerald-700 font-medium mono">{String(current ?? "—")}</span>
    </div>
  );
}

export default function Compare() {
  const { sku, sourceSku } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    setData(null); setError(null);
    api.get(`/products/${sku}/compare/${sourceSku}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Gagal memuat diff"));
    api.get("/products").then((r) => setAllProducts(r.data));
  }, [sku, sourceSku]);

  const otherProducts = useMemo(
    () => allProducts.filter((p) => p.sku !== sku && p.sku !== sourceSku),
    [allProducts, sku, sourceSku]
  );

  if (error) return (
    <div className="p-6">
      <div className="text-red-600 mb-3">{error}</div>
      <Link to={`/products/${sku}`}><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Kembali</Button></Link>
    </div>
  );
  if (!data) return <div className="p-6 text-slate-400">Memuat diff...</div>;

  const { current, source, summary } = data;

  const totalChanges = Object.values(summary).reduce((acc, s) => acc + s.added + s.removed + s.changed, 0);

  return (
    <div className="print-area">
      <div className="no-print mb-4">
        <Link to={`/products/${sku}`} className="text-sm text-amber-700 hover:underline inline-flex items-center"><ArrowLeft className="w-4 h-4 mr-1" />Kembali ke produk</Link>
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Bandingkan Versi Produk</div>
          <h1 data-testid="compare-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {current.sku} <span className="text-slate-400 mx-2 font-normal">vs</span> {source.sku}
          </h1>
          <div className="text-sm text-slate-600 mt-1">
            <span className="font-medium">Produk Saat Ini:</span> {current.nama_produk} ({current.versi}) ·
            <span className="font-medium ml-2">Produk Pembanding:</span> {source.nama_produk} ({source.versi})
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Select value={sourceSku} onValueChange={(v) => nav(`/products/${sku}/compare/${v}`)}>
            <SelectTrigger className="w-64" data-testid="compare-source-select">
              <SelectValue placeholder="Pilih produk pembanding lain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={sourceSku}>{sourceSku} (saat ini)</SelectItem>
              {otherProducts.map((p) => (
                <SelectItem key={p.sku} value={p.sku}>{p.sku} — {p.nama_pendek || p.nama_produk}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white" data-testid="print-compare">
            <Printer className="w-4 h-4 mr-2" />Cetak
          </Button>
        </div>
      </header>

      {/* Summary Card */}
      <section className="bg-white border-2 border-amber-200 rounded-md p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-semibold uppercase tracking-wide text-slate-700">Ringkasan Perubahan</h2>
        </div>
        <p className="text-sm text-slate-700 mb-4" data-testid="compare-summary-text">
          {totalChanges === 0 ? (
            <>Produk <span className="font-mono">{current.sku}</span> identik dengan <span className="font-mono">{source.sku}</span>.</>
          ) : (
            <>Produk <span className="font-mono">{current.sku}</span> memiliki <strong>{summary.recipe.added + summary.recipe.removed + summary.recipe.changed} perubahan recipe</strong>, <strong>{summary.bundles.added + summary.bundles.removed + summary.bundles.changed} perubahan bundle</strong>, <strong>{summary.pin_map.added + summary.pin_map.removed + summary.pin_map.changed} pin map berubah</strong>, dan <strong>{summary.qc_template.added + summary.qc_template.removed + summary.qc_template.changed} QC item berubah</strong> dibandingkan <span className="font-mono">{source.sku}</span>.</>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Recipe / Kabel" summary={summary.recipe} testid="sum-recipe" />
          <SummaryCard label="Bundle" summary={summary.bundles} testid="sum-bundles" />
          <SummaryCard label="Work Instruction" summary={summary.work_instructions} testid="sum-wi" />
          <SummaryCard label="Pin Map" summary={summary.pin_map} testid="sum-pinmap" />
          <SummaryCard label="QC Template" summary={summary.qc_template} testid="sum-qc" />
          <SummaryCard label="Common Mistakes" summary={summary.common_mistakes} testid="sum-mistakes" />
        </div>
      </section>

      <Tabs defaultValue="recipe">
        <TabsList className="mb-4 flex-wrap h-auto no-print">
          <TabsTrigger data-testid="diff-tab-recipe" value="recipe">Recipe</TabsTrigger>
          <TabsTrigger data-testid="diff-tab-bundles" value="bundles">Bundle</TabsTrigger>
          <TabsTrigger data-testid="diff-tab-wi" value="wi">Work Instruction</TabsTrigger>
          <TabsTrigger data-testid="diff-tab-pinmap" value="pinmap">Pin Map</TabsTrigger>
          <TabsTrigger data-testid="diff-tab-qc" value="qc">QC Template</TabsTrigger>
          <TabsTrigger data-testid="diff-tab-mistakes" value="mistakes">Common Mistakes</TabsTrigger>
        </TabsList>

        <TabsContent value="recipe"><RecipeDiff diff={data.recipe} /></TabsContent>
        <TabsContent value="bundles"><BundleDiff diff={data.bundles} /></TabsContent>
        <TabsContent value="wi"><WorkInstructionDiff diff={data.work_instructions} /></TabsContent>
        <TabsContent value="pinmap"><PinMapDiff diff={data.pin_map} /></TabsContent>
        <TabsContent value="qc"><QcDiff diff={data.qc_template} /></TabsContent>
        <TabsContent value="mistakes"><MistakeDiff diff={data.common_mistakes} /></TabsContent>
      </Tabs>

      {/* PRINT-ONLY: render all sections sequentially */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold mt-6 mb-2 border-b border-black pb-1">Recipe</h2>
        <RecipeDiff diff={data.recipe} compact />
        <h2 className="text-lg font-bold mt-6 mb-2 border-b border-black pb-1">Bundle</h2>
        <BundleDiff diff={data.bundles} compact />
        <h2 className="text-lg font-bold mt-6 mb-2 border-b border-black pb-1">Work Instruction</h2>
        <WorkInstructionDiff diff={data.work_instructions} compact />
        <h2 className="text-lg font-bold mt-6 mb-2 border-b border-black pb-1">Pin Map</h2>
        <PinMapDiff diff={data.pin_map} compact />
        <h2 className="text-lg font-bold mt-6 mb-2 border-b border-black pb-1">QC Template</h2>
        <QcDiff diff={data.qc_template} compact />
        <h2 className="text-lg font-bold mt-6 mb-2 border-b border-black pb-1">Common Mistakes</h2>
        <MistakeDiff diff={data.common_mistakes} compact />
      </div>
    </div>
  );
}

function RecipeDiff({ diff, compact }) {
  const rows = compact ? diff.rows.filter((r) => r.status !== "unchanged") : diff.rows;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Cable Code</TableHead>
          <TableHead>Saat Ini</TableHead>
          <TableHead>Pembanding</TableHead>
          <TableHead>Perubahan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key} data-testid={`recipe-diff-${r.key}`}>
            <TableCell><StatusChip status={r.status} /></TableCell>
            <TableCell className="font-mono font-semibold">{r.key}</TableCell>
            <TableCell className="text-xs">
              {r.current ? <>Qty {r.current.qty_per_pcs} · Bundle {r.current.bundle_code} · skunA: {r.current.skun_a || "-"} · solder: {r.current.perlu_solder ? "Ya" : "-"}</> : "—"}
            </TableCell>
            <TableCell className="text-xs">
              {r.source ? <>Qty {r.source.qty_per_pcs} · Bundle {r.source.bundle_code} · skunA: {r.source.skun_a || "-"} · solder: {r.source.perlu_solder ? "Ya" : "-"}</> : "—"}
            </TableCell>
            <TableCell>
              {r.changes.map((f) => (
                <FieldDiff key={f} field={f} current={r.current?.[f]} source={r.source?.[f]} />
              ))}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">Tidak ada perubahan.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function BundleDiff({ diff, compact }) {
  const rows = compact ? diff.rows.filter((r) => r.status !== "unchanged") : diff.rows;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} data-testid={`bundle-diff-${r.key}`} className="border border-slate-200 rounded-md p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={r.status} />
            <div className="font-mono font-semibold">Bundle {r.key}</div>
            {r.current?.bundle_name && <span className="text-sm text-slate-600">— {r.current.bundle_name}</span>}
          </div>
          {r.changes.length > 0 && (
            <div className="space-y-0.5">
              {r.changes.filter((f) => f !== "cables_in_bundle").map((f) => (
                <FieldDiff key={f} field={f} current={r.current?.[f]} source={r.source?.[f]} />
              ))}
              {r.changes.includes("cables_in_bundle") && (
                <div className="text-xs mt-1">
                  <div><span className="text-slate-500">Kabel pembanding:</span> <span className="font-mono">{(r.source_cables || []).join(", ") || "—"}</span></div>
                  <div><span className="text-slate-500">Kabel saat ini:</span> <span className="font-mono">{(r.current_cables || []).join(", ") || "—"}</span></div>
                </div>
              )}
            </div>
          )}
          {r.status === "added" && <div className="text-xs text-slate-600">Bundle baru: {r.current?.bundle_name}. Target: {r.current?.target_relay_pin || "-"}</div>}
          {r.status === "removed" && <div className="text-xs text-slate-600">Bundle dihapus: {r.source?.bundle_name}.</div>}
        </div>
      ))}
      {rows.length === 0 && <div className="text-center text-slate-500 py-6">Tidak ada perubahan.</div>}
    </div>
  );
}

function WorkInstructionDiff({ diff, compact }) {
  const rows = compact ? diff.rows.filter((r) => r.status !== "unchanged") : diff.rows;
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.key} data-testid={`wi-diff-${r.key}`} className="border border-slate-200 rounded-md p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={r.status} />
            <div className="font-mono font-semibold">Bundle {r.key}</div>
            <Badge variant="outline" className="text-xs">{(r.current_steps?.length || r.source_steps?.length || 0)} step</Badge>
          </div>
          {r.step_diff && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Saat Ini</TableHead>
                  <TableHead>Pembanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.step_diff.rows.filter((s) => !compact || s.status !== "unchanged").map((s) => (
                  <TableRow key={s.key}>
                    <TableCell><StatusChip status={s.status} /></TableCell>
                    <TableCell className="mono">{s.key}</TableCell>
                    <TableCell className="text-xs">{s.current?.instruksi || "—"}</TableCell>
                    <TableCell className="text-xs">{s.source?.instruksi || "—"}</TableCell>
                  </TableRow>
                ))}
                {r.step_diff.rows.filter((s) => !compact || s.status !== "unchanged").length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-3 text-xs">Tidak ada step yang berubah.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
      {rows.length === 0 && <div className="text-center text-slate-500 py-6">Tidak ada perubahan.</div>}
    </div>
  );
}

function PinMapDiff({ diff, compact }) {
  const rows = compact ? diff.rows.filter((r) => r.status !== "unchanged") : diff.rows;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} data-testid={`pinmap-diff-${r.key}`} className="border border-slate-200 rounded-md p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={r.status} />
            <div className="font-semibold">Relay {r.key}: {r.current?.relay_name || r.source?.relay_name}</div>
            <Badge variant="outline" className="font-mono">{r.current?.relay_type || r.source?.relay_type}</Badge>
          </div>
          {r.changes.filter((f) => f !== "pins").map((f) => (
            <FieldDiff key={f} field={f} current={r.current?.[f]} source={r.source?.[f]} />
          ))}
          {r.pin_diff && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-16">Pin</TableHead>
                  <TableHead>Saat Ini</TableHead>
                  <TableHead>Pembanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.pin_diff.rows.filter((p) => !compact || p.status !== "unchanged").map((p) => (
                  <TableRow key={p.key}>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                    <TableCell className="font-mono font-semibold">{p.key}</TableCell>
                    <TableCell className="text-xs"><span className="font-mono">{p.current?.cable_code || "—"}</span> · {p.current?.fungsi || ""}</TableCell>
                    <TableCell className="text-xs"><span className="font-mono">{p.source?.cable_code || "—"}</span> · {p.source?.fungsi || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
      {rows.length === 0 && <div className="text-center text-slate-500 py-6">Tidak ada perubahan.</div>}
    </div>
  );
}

function QcDiff({ diff, compact }) {
  const rows = compact ? diff.rows.filter((r) => r.status !== "unchanged") : diff.rows;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Status</TableHead>
          <TableHead>QC Item</TableHead>
          <TableHead>Saat Ini</TableHead>
          <TableHead>Pembanding</TableHead>
          <TableHead>Perubahan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key} data-testid={`qc-diff-${r.key}`}>
            <TableCell><StatusChip status={r.status} /></TableCell>
            <TableCell className="font-medium">{r.key}</TableCell>
            <TableCell className="text-xs">{r.current ? `${r.current.cara_tes || ""} → ${r.current.expected || ""}` : "—"}</TableCell>
            <TableCell className="text-xs">{r.source ? `${r.source.cara_tes || ""} → ${r.source.expected || ""}` : "—"}</TableCell>
            <TableCell>
              {r.changes.map((f) => (
                <FieldDiff key={f} field={f} current={r.current?.[f]} source={r.source?.[f]} />
              ))}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">Tidak ada perubahan.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function MistakeDiff({ diff, compact }) {
  const rows = compact ? diff.rows.filter((r) => r.status !== "unchanged") : diff.rows;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} data-testid={`mistake-diff-${r.key}`} className="border border-slate-200 rounded-md p-3 bg-white">
          <div className="flex items-center gap-2 mb-1">
            <StatusChip status={r.status} />
            <div className="font-semibold">{r.key}</div>
          </div>
          {r.changes.map((f) => (
            <FieldDiff key={f} field={f} current={r.current?.[f]} source={r.source?.[f]} />
          ))}
        </div>
      ))}
      {rows.length === 0 && <div className="text-center text-slate-500 py-6">Tidak ada perubahan.</div>}
    </div>
  );
}
