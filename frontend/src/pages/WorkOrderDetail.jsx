import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth, hasRole } from "@/lib/auth";
import {
  ArrowLeft, Printer, Scissors, CheckCircle2, AlertTriangle,
  Package, ClipboardCheck, Plug, QrCode,
} from "lucide-react";
import { WO_STATUSES, fmtDate, fmtDateTime } from "@/lib/utils-app";
import { toast } from "sonner";

export default function WorkOrderDetail() {
  const { woNumber } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [qc, setQc] = useState(null);
  const [pinMap, setPinMap] = useState([]);

  const load = async () => {
    const [cs, b, q, pm] = await Promise.all([
      api.get(`/work-orders/${woNumber}/cutting-sheet`),
      api.get(`/work-orders/${woNumber}/bundles`),
      api.get(`/work-orders/${woNumber}/qc`),
      api.get(`/work-orders/${woNumber}`).then(() => api.get(`/products/${(cs?.data?.wo?.product_sku) || ""}/pin-map`).catch(() => ({ data: [] }))),
    ]).catch(() => []);
    if (!cs) return;
    setData(cs.data);
    setBundles(b.data.bundles);
    setQc(q.data);
    // load pinmap with correct sku
    const pmRes = await api.get(`/products/${cs.data.wo.product_sku}/pin-map`).catch(() => ({ data: [] }));
    setPinMap(pmRes.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [woNumber]);

  const setStatus = async (s) => {
    await api.put(`/work-orders/${woNumber}`, { status: s });
    toast.success(`Status -> ${s}`);
    load();
  };

  const markCuttingDone = async () => {
    await api.post(`/work-orders/${woNumber}/mark-cutting-done`);
    toast.success("Cutting selesai");
    load();
  };

  const setBatchColor = async (cable_code, warna_aktual, alasan) => {
    try {
      const { data: r } = await api.post(`/work-orders/${woNumber}/batch-colors`, { cable_code, warna_aktual, alasan: alasan || undefined });
      if (r.warning) toast.warning(r.warning);
      else toast.success("Warna aktual disimpan");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    }
  };

  if (!data) return <div className="text-slate-400">Memuat...</div>;
  const { wo, product, rows } = data;

  const printAreaUrl = (kind) => `/work-orders/${woNumber}/print/${kind}`;
  const canEdit = hasRole(user, "Admin", "Production");

  return (
    <div>
      <PageHeader
        title={<span className="font-mono">{wo.wo_number}</span>}
        subtitle={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{product?.nama_produk}</span>
            <Badge variant="outline" className="font-mono">{wo.product_sku}</Badge>
            <StatusBadge status={wo.status} />
            <StatusBadge status={wo.prioritas} />
          </div>
        }
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to="/work-orders"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Kembali</Button></Link>
            {canEdit && (
              <Select value={wo.status} onValueChange={setStatus}>
                <SelectTrigger className="w-48" data-testid="wo-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      <Section className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div><div className="text-slate-500 text-xs uppercase">Reseller</div><div>{wo.reseller || "-"}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Qty</div><div className="mono font-semibold">{wo.qty} pcs</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Tanggal</div><div>{fmtDate(wo.tanggal)}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Deadline</div><div>{wo.deadline ? fmtDate(wo.deadline) : "-"}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Dibuat oleh</div><div>{wo.created_by || "-"}</div></div>
          {wo.catatan && <div className="col-span-2 md:col-span-5"><div className="text-slate-500 text-xs uppercase">Catatan</div><div className="text-slate-700">{wo.catatan}</div></div>}
        </div>
      </Section>

      <Tabs defaultValue="cutting">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger data-testid="tab-cutting" value="cutting"><Scissors className="w-4 h-4 mr-1" />Cutting Sheet</TabsTrigger>
          <TabsTrigger data-testid="tab-bundle-labels" value="bundles"><Package className="w-4 h-4 mr-1" />Bundle Labels</TabsTrigger>
          <TabsTrigger data-testid="tab-pinmap" value="pinmap"><Plug className="w-4 h-4 mr-1" />Pin Map</TabsTrigger>
          <TabsTrigger data-testid="tab-qc" value="qc"><ClipboardCheck className="w-4 h-4 mr-1" />QC Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="cutting">
          <Section
            title="Cutting Sheet"
            action={
              <div className="flex gap-2">
                {canEdit && wo.status !== "Cutting Selesai" && wo.status !== "Done" && (
                  <Button data-testid="mark-cutting-done" onClick={markCuttingDone} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="w-4 h-4 mr-2" />Tandai Cutting Selesai</Button>
                )}
                <Link to={printAreaUrl("cutting-sheet")} target="_blank">
                  <Button data-testid="print-cutting" className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak</Button>
                </Link>
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cable Code</TableHead>
                  <TableHead>Fungsi</TableHead>
                  <TableHead>Ukuran</TableHead>
                  <TableHead>Panjang</TableHead>
                  <TableHead className="text-right">Qty/pcs</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Warna Default</TableHead>
                  <TableHead>Warna Aktual</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Bundle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <CuttingRow key={r.cable_code} row={r} onSet={setBatchColor} canEdit={canEdit} />
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="flex justify-end mb-3">
            <Link to={printAreaUrl("bundle-labels")} target="_blank">
              <Button data-testid="print-bundle-labels" className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak Semua Bundle Label</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bundles.map((b) => (
              <div key={b.bundle_code} className="bg-white border-2 border-slate-300 rounded-md p-4" data-testid={`wo-bundle-${b.bundle_code}`}>
                <div className="flex items-center justify-between border-b pb-2 mb-3">
                  <div>
                    <div className="text-xs text-slate-500 font-mono">{wo.wo_number}</div>
                    <div className="font-bold text-lg">BUNDLE {b.bundle_code} — {b.bundle_name?.toUpperCase()}</div>
                    <div className="text-xs text-slate-500">{b.fungsi_bundle}</div>
                  </div>
                  <Link to={`/work-orders/${wo.wo_number}/bundles/${b.bundle_code}`}>
                    <Button size="sm" variant="outline" data-testid={`bundle-open-${b.bundle_code}`}><QrCode className="w-4 h-4 mr-1" />Bundle Detail</Button>
                  </Link>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cable</TableHead>
                      <TableHead>Ukuran</TableHead>
                      <TableHead>Panjang</TableHead>
                      <TableHead>Warna</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.cables.map((c) => (
                      <TableRow key={c.cable_code}>
                        <TableCell className="font-mono">{c.cable_code}</TableCell>
                        <TableCell className="mono">{c.ukuran_kabel}</TableCell>
                        <TableCell className="mono">{c.panjang_cm} cm</TableCell>
                        <TableCell>{c.warna || "-"}</TableCell>
                        <TableCell className="text-right mono">x{c.total_qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {b.instruksi_singkat && <div className="text-xs text-slate-600 mt-2 leading-relaxed border-t pt-2">{b.instruksi_singkat}</div>}
                {b.target_relay_pin && <div className="text-xs text-amber-700 mt-1 font-medium">Target: {b.target_relay_pin}</div>}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pinmap">
          <div className="flex justify-end mb-3">
            <Link to={printAreaUrl("pin-map")} target="_blank">
              <Button data-testid="print-pinmap" className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak Pin Map</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pinMap.map((r) => (
              <div key={r.relay_number} className="bg-white border border-slate-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500">Relay {r.relay_number}</div>
                    <div className="font-semibold">{r.relay_name}</div>
                  </div>
                  <Badge variant="outline" className="font-mono">{r.relay_type}</Badge>
                </div>
                <Table>
                  <TableBody>
                    {r.pins.map((p) => (
                      <TableRow key={p.pin_number}>
                        <TableCell className="font-mono font-semibold w-12">{p.pin_number}</TableCell>
                        <TableCell className="font-mono text-xs">{p.cable_code || "-"}</TableCell>
                        <TableCell className="text-xs text-slate-600">{p.fungsi}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="qc">
          <QcPanel qc={qc} woNumber={woNumber} onSaved={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CuttingRow({ row, onSet, canEdit }) {
  const [val, setVal] = useState(row.warna_aktual || "");
  const [reason, setReason] = useState(row.alasan_substitusi || "");
  const needsReason = row.warna_wajib && row.warna_default && val && val.toLowerCase() !== (row.warna_default || "").toLowerCase();
  const substitute = row.substitusi;
  return (
    <TableRow data-testid={`cs-row-${row.cable_code}`} className={substitute ? "bg-amber-50" : ""}>
      <TableCell className="font-mono font-semibold">{row.cable_code}</TableCell>
      <TableCell>
        <div>{row.nama_fungsi}</div>
        {row.warna_wajib && <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs mt-0.5">Warna Wajib</Badge>}
      </TableCell>
      <TableCell className="mono">{row.ukuran_kabel}</TableCell>
      <TableCell className="mono">{row.panjang_cm} cm</TableCell>
      <TableCell className="text-right mono">{row.qty_per_pcs}</TableCell>
      <TableCell className="text-right mono font-semibold">{row.total_qty}</TableCell>
      <TableCell>{row.warna_default || "-"}</TableCell>
      <TableCell>
        {canEdit ? (
          <div className="flex flex-col gap-1 min-w-[180px]">
            <Input data-testid={`cs-color-${row.cable_code}`} placeholder={row.warna_default} value={val} onChange={(e) => setVal(e.target.value)} className="h-8 text-sm" />
            {needsReason && (
              <Input data-testid={`cs-reason-${row.cable_code}`} placeholder="Alasan substitusi (wajib)" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" />
            )}
            <Button size="sm" variant="outline" className="h-7" onClick={() => onSet(row.cable_code, val.trim() || row.warna_default, reason)} data-testid={`cs-save-${row.cable_code}`}>Simpan</Button>
            {substitute && <div className="text-xs text-amber-700 flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" />Substitusi</div>}
          </div>
        ) : (
          <div>
            {row.warna_aktual}
            {substitute && <div className="text-xs text-amber-700">Substitusi</div>}
          </div>
        )}
      </TableCell>
      <TableCell className="font-mono">{row.nomor_program || "-"}</TableCell>
      <TableCell><Badge variant="outline" className="font-mono">{row.bundle_code}</Badge></TableCell>
    </TableRow>
  );
}

function QcPanel({ qc, woNumber, onSaved }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [rework, setRework] = useState("");

  useEffect(() => {
    if (!qc) return;
    const tmplItems = qc.template?.items || [];
    const resultItems = qc.result?.items || [];
    const merged = tmplItems.map((t) => {
      const existing = resultItems.find((r) => r.item_id === t.id);
      return {
        item_id: t.id, nama: t.nama, required: t.required,
        pass_fail: existing?.pass_fail || "NA", catatan: existing?.catatan || "",
      };
    });
    setItems(merged);
    setRework(qc.result?.catatan_rework || "");
  }, [qc]);

  const updateItem = (i, patch) => {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const submit = async () => {
    try {
      const { data } = await api.post(`/work-orders/${woNumber}/qc`, { items, catatan_rework: rework });
      toast.success(`QC tersimpan — ${data.result.overall}`);
      onSaved?.();
    } catch (e) { toast.error("Gagal"); }
  };

  const canEdit = hasRole(user, "Admin", "QC", "Production");
  const overall = qc?.result?.overall;

  return (
    <Section
      title="QC Checklist"
      action={
        <div className="flex gap-2 items-center">
          {overall && <StatusBadge status={overall} />}
          <Link to={`/work-orders/${woNumber}/print/qc-checklist`} target="_blank">
            <Button data-testid="print-qc" variant="outline"><Printer className="w-4 h-4 mr-2" />Cetak</Button>
          </Link>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Pass/Fail</TableHead>
            <TableHead>Catatan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, i) => (
            <TableRow key={it.item_id} data-testid={`qc-row-${i}`}>
              <TableCell className="mono">{i + 1}</TableCell>
              <TableCell>
                <div className="font-medium">{it.nama}</div>
                {it.required && <Badge className="text-xs">Wajib</Badge>}
              </TableCell>
              <TableCell>
                <Select value={it.pass_fail} onValueChange={(v) => updateItem(i, { pass_fail: v })} disabled={!canEdit}>
                  <SelectTrigger className="w-28" data-testid={`qc-pf-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NA">-</SelectItem>
                    <SelectItem value="Pass">Pass</SelectItem>
                    <SelectItem value="Fail">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input data-testid={`qc-note-${i}`} value={it.catatan || ""} onChange={(e) => updateItem(i, { catatan: e.target.value })} placeholder={it.pass_fail === "Fail" ? "Wajib isi jika Fail" : "Opsional"} disabled={!canEdit} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          <div>
            <Label>Catatan Rework / Note</Label>
            <Textarea data-testid="qc-rework" value={rework} onChange={(e) => setRework(e.target.value)} disabled={!canEdit} />
          </div>
          {canEdit && (
            <Button data-testid="qc-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700 text-white">Simpan QC Result</Button>
          )}
          {qc?.result?.timestamp && <div className="text-xs text-slate-500">Terakhir disimpan oleh {qc.result.qc_person} pada {fmtDateTime(qc.result.timestamp)}</div>}
        </div>
      )}
    </Section>
  );
}
