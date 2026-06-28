import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { ArrowLeft, ArrowRight, AlertTriangle, Plug, Printer } from "lucide-react";
import ProductionBriefing, { ChangedBadge, cableChangeKind, bundleChangeKind } from "@/components/ProductionBriefing";
import { ImageGalleryReadOnly } from "@/components/ImageUploader";

export default function BundleDetail() {
  const { woNumber, bundleCode } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    api.get(`/work-orders/${woNumber}/bundles/${bundleCode}`).then((r) => {
      setData(r.data);
      setChecked({});
    });
  }, [woNumber, bundleCode]);

  if (!data) return <div className="p-6 text-slate-400">Memuat...</div>;
  const { wo, product, bundle, cables, work_instruction, common_mistakes, prev_bundle, next_bundle } = data;
  const briefing = wo.briefing;
  const bundleChanged = bundleChangeKind(briefing, bundle.bundle_code);

  return (
    <div>
      <PageHeader
        title={<span>Bundle {bundle.bundle_code} — {bundle.bundle_name}</span>}
        subtitle={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link to={`/work-orders/${wo.wo_number}`} className="font-mono text-amber-700 hover:underline">{wo.wo_number}</Link>
            <Badge variant="outline" className="font-mono">{wo.product_sku}</Badge>
            <span>{product?.nama_pendek || product?.nama_produk}</span>
            <StatusBadge status={wo.status} />
            <span className="text-slate-500">Qty: <span className="font-semibold">{wo.qty}</span> set</span>
          </div>
        }
        actions={
          <div className="flex gap-2">
            <Link to={`/work-orders/${wo.wo_number}`}><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Kembali ke WO</Button></Link>
            <Button variant="outline" onClick={() => window.print()} data-testid="bundle-print"><Printer className="w-4 h-4 mr-2" />Cetak</Button>
          </div>
        }
      />

      {bundleChanged && (
        <div data-testid="bundle-changed-alert" className="bg-amber-100 border-2 border-amber-300 rounded-md p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-bold text-amber-900">Bundle ini berbeda dari versi asal ({briefing.compared_to_sku}).</div>
            <div className="text-amber-800 text-xs mt-1">
              Periksa daftar kabel, instruksi, dan target pin di bawah. Jangan menggunakan kebiasaan dari versi lama.
            </div>
          </div>
        </div>
      )}

      <ProductionBriefing briefing={briefing} sku={wo.product_sku} compact />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <Section title={`Kabel — Bundle ${bundle.bundle_code}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cable Code</TableHead>
                  <TableHead>Fungsi</TableHead>
                  <TableHead>Ukuran</TableHead>
                  <TableHead>Panjang</TableHead>
                  <TableHead>Warna Aktual</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cables.map((c) => {
                  const ck = cableChangeKind(briefing, c.cable_code);
                  return (
                  <TableRow key={c.id} className={c.substitusi ? "bg-amber-50" : ""}>
                    <TableCell className="font-mono font-semibold">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.cable_code}
                        {ck && <ChangedBadge kind={ck} />}
                      </div>
                    </TableCell>
                    <TableCell>{c.nama_fungsi}</TableCell>
                    <TableCell className="mono">{c.ukuran_kabel}</TableCell>
                    <TableCell className="mono">{c.panjang_cm} cm</TableCell>
                    <TableCell>
                      {c.warna}
                      {c.substitusi && <div className="text-xs text-amber-700">Substitusi dari {c.warna_default}</div>}
                    </TableCell>
                    <TableCell className="text-right mono">x{c.total_qty}</TableCell>
                  </TableRow>
                );})}
              </TableBody>
            </Table>
          </Section>
        </div>
        <div>
          <Section title="Info Bundle">
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500 text-xs uppercase">Fungsi:</span><div>{bundle.fungsi_bundle}</div></div>
              <div><span className="text-slate-500 text-xs uppercase">Instruksi Singkat:</span><div>{bundle.instruksi_singkat}</div></div>
              {bundle.target_relay_pin && (
                <div className="flex items-start gap-2 text-amber-700 font-medium border-t pt-2 mt-2">
                  <Plug className="w-4 h-4 mt-0.5" />
                  <div>
                    <div className="text-xs uppercase text-slate-500">Target</div>
                    {bundle.target_relay_pin}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <ImageGalleryReadOnly
                relatedType="bundle"
                relatedId={bundle.id}
                compact={true}
                emptyHide={true}
                testIdPrefix="bundle-detail-photo"
              />
            </div>
          </Section>
        </div>
      </div>

      <Section title="Work Instruction — Step by Step" className="mb-4">
        {work_instruction.steps?.length === 0 && <div className="text-sm text-slate-500">Belum ada instruksi.</div>}
        <ol className="space-y-3">
          {work_instruction.steps?.map((s) => (
            <li key={s.step_number} data-testid={`step-${s.step_number}`} className="flex gap-3">
              <Checkbox
                checked={!!checked[s.step_number]}
                onCheckedChange={(v) => setChecked({ ...checked, [s.step_number]: !!v })}
                className="mt-1"
                data-testid={`step-check-${s.step_number}`}
              />
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-amber-700 font-semibold w-8">#{s.step_number}</span>
                  <span className={`font-medium ${checked[s.step_number] ? "line-through text-slate-400" : "text-slate-900"}`}>{s.instruksi}</span>
                </div>
                <div className="ml-10 mt-1 space-y-0.5 text-xs">
                  {s.komponen && <div><span className="text-slate-500">Komponen:</span> <span className="font-mono">{s.komponen}</span></div>}
                  {s.tools && <div><span className="text-slate-500">Tools:</span> {s.tools}</div>}
                  {s.safety && <div className="text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{s.safety}</div>}
                  {s.common_mistake && <div className="text-red-700">Hati-hati: {s.common_mistake}</div>}
                </div>
                <div className="ml-10 mt-2 space-y-2">
                  {s.foto_url && (
                    <a href={s.foto_url} target="_blank" rel="noreferrer" data-testid={`step-legacy-photo-${s.step_number}`}>
                      <img src={s.foto_url} alt={`Step ${s.step_number}`} className="max-w-xs rounded border border-slate-200" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </a>
                  )}
                  <ImageGalleryReadOnly
                    relatedType="work_instruction_step"
                    relatedId={`${wo.product_sku}:${bundle.bundle_code}:${s.step_number}`}
                    compact={true}
                    emptyHide={true}
                    testIdPrefix={`step-photo-${s.step_number}`}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {common_mistakes.length > 0 && (
        <Section title="Common Mistakes Bundle Ini" className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {common_mistakes.map((m) => (
              <div key={m.id} className="border border-amber-200 bg-amber-50 rounded-md p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{m.kesalahan}</div>
                    <div className="mt-1"><span className="text-slate-500">Akibat:</span> {m.akibat}</div>
                    <div className="text-emerald-700 mt-0.5"><span className="font-semibold">Cara mencegah:</span> {m.cara_mencegah}</div>
                    <div className="mt-2">
                      <ImageGalleryReadOnly
                        relatedType="common_mistake"
                        relatedId={m.id}
                        compact={true}
                        emptyHide={true}
                        testIdPrefix={`mistake-photo-${m.id}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex justify-between mt-6">
        <Button
          data-testid="bundle-prev"
          variant="outline"
          disabled={!prev_bundle}
          onClick={() => prev_bundle && nav(`/work-orders/${wo.wo_number}/bundles/${prev_bundle}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Bundle Sebelumnya {prev_bundle ? `(${prev_bundle})` : ""}
        </Button>
        <Button
          data-testid="bundle-next"
          variant="outline"
          disabled={!next_bundle}
          onClick={() => next_bundle && nav(`/work-orders/${wo.wo_number}/bundles/${next_bundle}`)}
        >
          Bundle Berikutnya {next_bundle ? `(${next_bundle})` : ""} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
