import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth, hasRole } from "@/lib/auth";
import { Search, Plus, Trash2, Pencil } from "lucide-react";
import { CABLE_CATEGORIES } from "@/lib/utils-app";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const empty = {
  cable_code: "", nama_fungsi: "", deskripsi: "",
  ukuran_kabel: "0.5mm", panjang_cm: 60, warna_default: "",
  kategori: "Output", warna_wajib: false, catatan_substitusi: "",
};

function EditDialog({ initial, isEdit, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial || empty);
  useEffect(() => { setForm(initial || empty); }, [initial, open]);
  const submit = async () => {
    try {
      const body = { ...form, panjang_cm: Number(form.panjang_cm) };
      if (isEdit) {
        await api.put(`/cable-functions/${initial.cable_code}`, body);
      } else {
        await api.post("/cable-functions", body);
      }
      toast.success("Tersimpan");
      setOpen(false);
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? "Ubah" : "Cable Function Baru"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Cable Code</Label><Input data-testid="cf-code" disabled={isEdit} value={form.cable_code} onChange={(e) => setForm({ ...form, cable_code: e.target.value })} /></div>
          <div><Label>Kategori</Label>
            <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Nama Fungsi</Label><Input data-testid="cf-nama" value={form.nama_fungsi} onChange={(e) => setForm({ ...form, nama_fungsi: e.target.value })} /></div>
          <div><Label>Ukuran Kabel</Label><Input value={form.ukuran_kabel} onChange={(e) => setForm({ ...form, ukuran_kabel: e.target.value })} /></div>
          <div><Label>Panjang (cm)</Label><Input type="number" step="0.1" value={form.panjang_cm} onChange={(e) => setForm({ ...form, panjang_cm: e.target.value })} /></div>
          <div><Label>Warna Default</Label><Input value={form.warna_default} onChange={(e) => setForm({ ...form, warna_default: e.target.value })} /></div>
          <div className="flex items-center gap-3 pt-6"><Switch checked={form.warna_wajib} onCheckedChange={(v) => setForm({ ...form, warna_wajib: v })} /> <Label>Warna Wajib?</Label></div>
          <div className="col-span-2"><Label>Catatan Substitusi</Label><Input value={form.catatan_substitusi || ""} onChange={(e) => setForm({ ...form, catatan_substitusi: e.target.value })} /></div>
        </div>
        <DialogFooter><Button data-testid="cf-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CableFunctions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("ALL");

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (kat !== "ALL") params.kategori = kat;
    const { data } = await api.get("/cable-functions", { params });
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, kat]);

  const del = async (code) => {
    if (!window.confirm(`Hapus ${code}?`)) return;
    await api.delete(`/cable-functions/${code}`);
    toast.success("Dihapus");
    load();
  };

  const isAdmin = hasRole(user, "Admin");

  return (
    <div>
      <PageHeader
        title="Master Kabel (Function First)"
        subtitle="Identitas kabel = kode fungsi + ukuran + panjang. Warna hanya default per batch."
        actions={isAdmin && (
          <EditDialog isEdit={false} onSaved={load} trigger={<Button data-testid="new-cable-btn" className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Cable Code Baru</Button>} />
        )}
      />
      <Section>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input data-testid="cable-search" className="pl-9" placeholder="Cari kode / nama / ukuran..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={kat} onValueChange={setKat}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kategori</SelectItem>
              {CABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cable Code</TableHead>
              <TableHead>Fungsi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Ukuran</TableHead>
              <TableHead>Panjang</TableHead>
              <TableHead>Warna Default</TableHead>
              <TableHead>Warna Wajib</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.cable_code} data-testid={`cable-row-${c.cable_code}`}>
                <TableCell className="font-mono font-semibold">{c.cable_code}</TableCell>
                <TableCell>{c.nama_fungsi}</TableCell>
                <TableCell><Badge variant="outline">{c.kategori}</Badge></TableCell>
                <TableCell className="mono">{c.ukuran_kabel}</TableCell>
                <TableCell className="mono">{c.panjang_cm} cm</TableCell>
                <TableCell>{c.warna_default || "-"}</TableCell>
                <TableCell>{c.warna_wajib ? <Badge className="bg-red-100 text-red-700 border-red-200 border">Wajib</Badge> : "-"}</TableCell>
                {isAdmin && (
                  <TableCell className="space-x-1">
                    <EditDialog initial={c} isEdit onSaved={load} trigger={<Button size="sm" variant="outline" data-testid={`cable-edit-${c.cable_code}`}><Pencil className="w-3 h-3" /></Button>} />
                    <Button size="sm" variant="outline" onClick={() => del(c.cable_code)} data-testid={`cable-del-${c.cable_code}`}><Trash2 className="w-3 h-3" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-slate-500 py-8">Tidak ada kabel.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
