import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth, hasRole } from "@/lib/auth";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { SKILL_LEVELS, fmtDate } from "@/lib/utils-app";
import { toast } from "sonner";

const SKILL_COLORS = {
  "Belum training": "bg-slate-100 text-slate-700 border-slate-200",
  "Training": "bg-blue-50 text-blue-700 border-blue-200",
  "Bisa dengan pengawasan": "bg-amber-50 text-amber-700 border-amber-200",
  "Bisa mandiri": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Trainer": "bg-purple-50 text-purple-700 border-purple-200",
};

function EditDialog({ initial, isEdit, products, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const empty = { nama_karyawan: "", product_sku: products[0]?.sku || "", skill_level: "Belum training", tanggal_training: "", approved_by: "", catatan: "" };
  const [form, setForm] = useState(initial || empty);
  useEffect(() => { setForm(initial || empty); /* eslint-disable-next-line */ }, [initial, open]);
  const submit = async () => {
    try {
      if (isEdit) await api.put(`/training-matrix/${initial.id}`, form);
      else await api.post("/training-matrix", form);
      toast.success("Tersimpan");
      setOpen(false);
      onSaved?.();
    } catch (e) { toast.error("Gagal"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Ubah" : "Tambah"} Training</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nama Karyawan</Label><Input data-testid="tm-nama" value={form.nama_karyawan} onChange={(e) => setForm({ ...form, nama_karyawan: e.target.value })} /></div>
          <div><Label>Produk / SKU</Label>
            <Select value={form.product_sku} onValueChange={(v) => setForm({ ...form, product_sku: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.sku}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Level Skill</Label>
            <Select value={form.skill_level} onValueChange={(v) => setForm({ ...form, skill_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Tanggal Training</Label><Input type="date" value={form.tanggal_training || ""} onChange={(e) => setForm({ ...form, tanggal_training: e.target.value })} /></div>
          <div><Label>Approved By</Label><Input value={form.approved_by || ""} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} /></div>
          <div><Label>Catatan</Label><Input value={form.catatan || ""} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></div>
        </div>
        <DialogFooter><Button data-testid="tm-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TrainingMatrix() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const load = async () => {
    const [t, p] = await Promise.all([api.get("/training-matrix"), api.get("/products")]);
    setItems(t.data); setProducts(p.data);
  };
  useEffect(() => { load(); }, []);
  const del = async (id) => {
    if (!window.confirm("Hapus?")) return;
    await api.delete(`/training-matrix/${id}`); load();
  };
  const isAdmin = hasRole(user, "Admin");

  return (
    <div>
      <PageHeader
        title="Training Matrix"
        subtitle="Kemampuan karyawan per produk."
        actions={isAdmin && (
          <EditDialog isEdit={false} products={products} onSaved={load} trigger={<Button data-testid="new-training-btn" className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Tambah</Button>} />
        )}
      />
      <Section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Produk / SKU</TableHead>
              <TableHead>Skill</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead>Catatan</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nama_karyawan}</TableCell>
                <TableCell className="font-mono text-xs">{t.product_sku}</TableCell>
                <TableCell><Badge className={`border ${SKILL_COLORS[t.skill_level] || ""}`}>{t.skill_level}</Badge></TableCell>
                <TableCell>{t.tanggal_training ? fmtDate(t.tanggal_training) : "-"}</TableCell>
                <TableCell>{t.approved_by || "-"}</TableCell>
                <TableCell className="text-sm text-slate-500">{t.catatan}</TableCell>
                {isAdmin && (
                  <TableCell className="space-x-1">
                    <EditDialog initial={t} isEdit products={products} onSaved={load} trigger={<Button size="sm" variant="outline"><Pencil className="w-3 h-3" /></Button>} />
                    <Button size="sm" variant="outline" onClick={() => del(t.id)}><Trash2 className="w-3 h-3" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
