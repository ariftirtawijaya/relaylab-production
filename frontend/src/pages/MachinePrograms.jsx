import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { useAuth, hasRole } from "@/lib/auth";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const empty = {
  nomor_program: "", ukuran_kabel: "0.5mm", panjang_cm: 60,
  strip_depan_mm: 5, strip_belakang_mm: 5,
  knife_setting: "", retreat_setting: "", catatan: "", cable_codes: [],
};

function EditDialog({ initial, isEdit, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial || empty);
  const [codes, setCodes] = useState((initial?.cable_codes || []).join(", "));
  useEffect(() => {
    setForm(initial || empty);
    setCodes((initial?.cable_codes || []).join(", "));
  }, [initial, open]);
  const submit = async () => {
    try {
      const body = {
        ...form,
        panjang_cm: Number(form.panjang_cm),
        strip_depan_mm: Number(form.strip_depan_mm),
        strip_belakang_mm: Number(form.strip_belakang_mm),
        cable_codes: codes.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (isEdit) await api.put(`/machine-programs/${initial.nomor_program}`, body);
      else await api.post("/machine-programs", body);
      toast.success("Tersimpan");
      setOpen(false);
      onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? "Ubah Program Mesin" : "Program Mesin Baru"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nomor Program</Label><Input data-testid="mp-number" disabled={isEdit} value={form.nomor_program} onChange={(e) => setForm({ ...form, nomor_program: e.target.value })} /></div>
          <div><Label>Ukuran Kabel</Label><Input value={form.ukuran_kabel} onChange={(e) => setForm({ ...form, ukuran_kabel: e.target.value })} /></div>
          <div><Label>Panjang (cm)</Label><Input type="number" step="0.1" value={form.panjang_cm} onChange={(e) => setForm({ ...form, panjang_cm: e.target.value })} /></div>
          <div><Label>Strip Depan (mm)</Label><Input type="number" step="0.1" value={form.strip_depan_mm} onChange={(e) => setForm({ ...form, strip_depan_mm: e.target.value })} /></div>
          <div><Label>Strip Belakang (mm)</Label><Input type="number" step="0.1" value={form.strip_belakang_mm} onChange={(e) => setForm({ ...form, strip_belakang_mm: e.target.value })} /></div>
          <div><Label>Knife Setting</Label><Input value={form.knife_setting || ""} onChange={(e) => setForm({ ...form, knife_setting: e.target.value })} /></div>
          <div><Label>Retreat Setting</Label><Input value={form.retreat_setting || ""} onChange={(e) => setForm({ ...form, retreat_setting: e.target.value })} /></div>
          <div className="col-span-2"><Label>Cable Codes (pisahkan koma)</Label><Input value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="DEV-OUT-S, HIGH-OUT-S" /></div>
          <div className="col-span-2"><Label>Catatan</Label><Input value={form.catatan || ""} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></div>
        </div>
        <DialogFooter><Button data-testid="mp-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MachinePrograms() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const load = async () => {
    const { data } = await api.get("/machine-programs");
    setItems(data);
  };
  useEffect(() => { load(); }, []);
  const del = async (n) => {
    if (!window.confirm(`Hapus ${n}?`)) return;
    await api.delete(`/machine-programs/${n}`);
    toast.success("Dihapus"); load();
  };
  const isAdmin = hasRole(user, "Admin");

  return (
    <div>
      <PageHeader
        title="Program Mesin SWT508C"
        subtitle="Setting program mesin potong kabel berdasarkan ukuran + panjang, bukan warna."
        actions={isAdmin && (
          <EditDialog isEdit={false} onSaved={load} trigger={<Button data-testid="new-mp-btn" className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Program Baru</Button>} />
        )}
      />
      <Section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Program</TableHead>
              <TableHead>Ukuran</TableHead>
              <TableHead>Panjang</TableHead>
              <TableHead>Strip Depan</TableHead>
              <TableHead>Strip Belakang</TableHead>
              <TableHead>Cable Codes</TableHead>
              <TableHead>Catatan</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((m) => (
              <TableRow key={m.nomor_program} data-testid={`mp-row-${m.nomor_program}`}>
                <TableCell className="font-mono font-semibold">{m.nomor_program}</TableCell>
                <TableCell className="mono">{m.ukuran_kabel}</TableCell>
                <TableCell className="mono">{m.panjang_cm} cm</TableCell>
                <TableCell className="mono">{m.strip_depan_mm} mm</TableCell>
                <TableCell className="mono">{m.strip_belakang_mm} mm</TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{m.cable_codes?.map((c) => <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>)}</div></TableCell>
                <TableCell className="text-xs text-slate-500">{m.catatan}</TableCell>
                {isAdmin && (
                  <TableCell className="space-x-1">
                    <EditDialog initial={m} isEdit onSaved={load} trigger={<Button size="sm" variant="outline"><Pencil className="w-3 h-3" /></Button>} />
                    <Button size="sm" variant="outline" onClick={() => del(m.nomor_program)}><Trash2 className="w-3 h-3" /></Button>
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
