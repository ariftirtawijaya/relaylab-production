import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, hasRole } from "@/lib/auth";
import { Plus, Search, Eye } from "lucide-react";
import { WO_STATUSES, fmtDate } from "@/lib/utils-app";
import { toast } from "sonner";

function NewWODialog({ open, setOpen, onCreated }) {
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [form, setForm] = useState({
    reseller: "", product_sku: "", qty: 100, deadline: "",
    prioritas: "Normal", catatan: "",
  });
  useEffect(() => {
    if (open) api.get("/products", { params: { status: "Released" } }).then((r) => setProducts(r.data));
  }, [open]);

  useEffect(() => {
    if (!form.product_sku) { setRecommendations([]); return; }
    api.get("/training-matrix", { params: { product_sku: form.product_sku, qualified_only: true } })
      .then((r) => setRecommendations(r.data));
  }, [form.product_sku]);

  const submit = async () => {
    try {
      const { data } = await api.post("/work-orders", { ...form, qty: Number(form.qty) });
      toast.success(`WO ${data.wo_number} dibuat`);
      setOpen(false);
      onCreated?.(data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Work Order Baru</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Produk (status Released)</Label>
            <Select value={form.product_sku} onValueChange={(v) => setForm({ ...form, product_sku: v })}>
              <SelectTrigger data-testid="wo-product"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.sku} — {p.nama_pendek || p.nama_produk}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.product_sku && (
            <div data-testid="wo-recommendations" className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
              <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Rekomendasi Operator (Bisa Kerjakan)</div>
              {recommendations.length === 0 ? (
                <div className="text-xs text-slate-600">Belum ada operator dengan skill <em>Bisa mandiri / Trainer</em> untuk produk ini. Update Training Matrix dulu.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recommendations.map((t) => (
                    <span key={t.id} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                      t.skill_level === "Trainer"
                        ? "bg-purple-100 text-purple-800 border-purple-200"
                        : "bg-emerald-100 text-emerald-800 border-emerald-200"
                    }`}>
                      {t.nama_karyawan}
                      <span className="opacity-70">· {t.skill_level}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Qty</Label><Input data-testid="wo-qty" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
            <div><Label>Prioritas</Label>
              <Select value={form.prioritas} onValueChange={(v) => setForm({ ...form, prioritas: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Reseller / Customer</Label><Input data-testid="wo-reseller" value={form.reseller} onChange={(e) => setForm({ ...form, reseller: e.target.value })} /></div>
          <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <div><Label>Catatan</Label><Textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></div>
        </div>
        <DialogFooter><Button data-testid="wo-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Buat Work Order</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkOrders() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [params, setParams] = useSearchParams();
  const [openNew, setOpenNew] = useState(params.get("new") === "1");

  const load = async () => {
    const p = {};
    if (q) p.q = q;
    if (status !== "ALL") p.status = status;
    const { data } = await api.get("/work-orders", { params: p });
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status]);

  return (
    <div>
      <PageHeader
        title="Work Orders / Perintah Kerja"
        subtitle="Buat, pantau, dan dokumentasikan pekerjaan produksi."
        actions={hasRole(user, "Admin", "Production") && (
          <Button data-testid="new-wo-btn" onClick={() => { setOpenNew(true); setParams({ new: "1" }); }} className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Work Order Baru</Button>
        )}
      />
      <NewWODialog open={openNew} setOpen={(v) => { setOpenNew(v); if (!v) setParams({}); }} onCreated={load} />
      <Section>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input data-testid="wo-search" className="pl-9" placeholder="Cari WO / reseller / SKU..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              {WO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>WO Number</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Reseller</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Prioritas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((wo) => (
              <TableRow key={wo.wo_number} data-testid={`wo-row-${wo.wo_number}`}>
                <TableCell><Link to={`/work-orders/${wo.wo_number}`} className="font-mono text-amber-700 hover:underline">{wo.wo_number}</Link></TableCell>
                <TableCell>{fmtDate(wo.tanggal)}</TableCell>
                <TableCell>{wo.reseller || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{wo.product_sku}</TableCell>
                <TableCell className="text-right mono">{wo.qty}</TableCell>
                <TableCell><StatusBadge status={wo.prioritas} /></TableCell>
                <TableCell><StatusBadge status={wo.status} /></TableCell>
                <TableCell className="text-xs">{wo.deadline ? fmtDate(wo.deadline) : "-"}</TableCell>
                <TableCell><Link to={`/work-orders/${wo.wo_number}`}><Button size="sm" variant="outline" data-testid={`wo-view-${wo.wo_number}`}><Eye className="w-4 h-4" /></Button></Link></TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">Belum ada Work Order.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
