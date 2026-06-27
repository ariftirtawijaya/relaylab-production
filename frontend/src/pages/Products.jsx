import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge, Section } from "@/components/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth, hasRole } from "@/lib/auth";
import { Plus, Search, Eye, GitBranch } from "lucide-react";
import { PRODUCT_STATUSES, fmtDate } from "@/lib/utils-app";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function NewProductDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sku: "", nama_produk: "", nama_pendek: "", kategori: "", versi: "V1",
    status: "Draft", kapasitas_normal: 100, konfigurasi: "", deskripsi: "",
  });
  const submit = async () => {
    try {
      const { data } = await api.post("/products", { ...form, kapasitas_normal: Number(form.kapasitas_normal || 0) });
      toast.success("Produk dibuat");
      setOpen(false);
      onCreated?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-product-btn" className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Produk Baru</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Produk Baru</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU</Label><Input data-testid="np-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div><Label>Versi</Label><Input data-testid="np-versi" value={form.versi} onChange={(e) => setForm({ ...form, versi: e.target.value })} /></div>
          <div className="col-span-2"><Label>Nama Produk</Label><Input data-testid="np-nama" value={form.nama_produk} onChange={(e) => setForm({ ...form, nama_produk: e.target.value })} /></div>
          <div><Label>Nama Pendek</Label><Input value={form.nama_pendek} onChange={(e) => setForm({ ...form, nama_pendek: e.target.value })} /></div>
          <div><Label>Kategori</Label><Input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Kapasitas/Hari</Label><Input type="number" value={form.kapasitas_normal} onChange={(e) => setForm({ ...form, kapasitas_normal: e.target.value })} /></div>
          <div className="col-span-2"><Label>Konfigurasi</Label><Input value={form.konfigurasi} onChange={(e) => setForm({ ...form, konfigurasi: e.target.value })} /></div>
          <div className="col-span-2"><Label>Deskripsi</Label><Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /></div>
        </div>
        <DialogFooter><Button data-testid="np-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionBadge({ p, groups, latestSkuByGroup }) {
  const g = p.version_group || p.sku;
  const groupSize = (groups[g] || []).length;
  const isLatest = latestSkuByGroup[g] === p.sku;
  const isClone = !!p.source_sku;
  return (
    <div className="flex flex-wrap gap-1">
      {!isClone && <Badge variant="outline" className="text-xs">Original</Badge>}
      {isClone && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">Clone</Badge>}
      {isLatest && groupSize > 1 && <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">Latest</Badge>}
      {groupSize > 1 && <Badge variant="outline" className="text-xs"><GitBranch className="w-3 h-3 mr-0.5" />{groupSize} versi</Badge>}
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (status !== "ALL") params.status = status;
    const { data } = await api.get("/products", { params });
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status]);

  // Compute version badges: group by version_group, mark Latest (highest created_at) per group
  const groups = {};
  items.forEach((p) => {
    const g = p.version_group || p.sku;
    (groups[g] = groups[g] || []).push(p);
  });
  Object.values(groups).forEach((arr) => arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
  const latestSkuByGroup = Object.fromEntries(Object.entries(groups).map(([g, arr]) => [g, arr[0].sku]));

  return (
    <div>
      <PageHeader
        title="Produk / SKU Master"
        subtitle="Master produk RelayLab. Tiap SKU punya recipe, bundle, pin map, dan QC template."
        actions={hasRole(user, "Admin") && <NewProductDialog onCreated={load} />}
      />
      <Section>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input data-testid="products-search" className="pl-9" placeholder="Cari SKU / nama produk..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Versi</TableHead>
              <TableHead>Versioning</TableHead>
              <TableHead>Kapasitas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.sku} data-testid={`product-row-${p.sku}`}>
                <TableCell className="font-mono">{p.sku}</TableCell>
                <TableCell>
                  <div className="font-medium">{p.nama_produk}</div>
                  {p.nama_pendek && <div className="text-xs text-slate-500">{p.nama_pendek}</div>}
                </TableCell>
                <TableCell>{p.kategori || "-"}</TableCell>
                <TableCell className="mono">{p.versi}</TableCell>
                <TableCell><VersionBadge p={p} groups={groups} latestSkuByGroup={latestSkuByGroup} /></TableCell>
                <TableCell className="mono">{p.kapasitas_normal}/hari</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-xs text-slate-500">{fmtDate(p.created_at)}</TableCell>
                <TableCell>
                  <Link to={`/products/${p.sku}`}>
                    <Button data-testid={`product-view-${p.sku}`} variant="outline" size="sm"><Eye className="w-4 h-4 mr-1" />Detail</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">Tidak ada produk.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
