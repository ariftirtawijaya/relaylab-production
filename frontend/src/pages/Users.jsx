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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const ROLES = ["Admin", "Production", "QC"];

function EditDialog({ initial, isEdit, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const empty = { name: "", username: "", email: "", password: "", role: "Production", active: true };
  const [form, setForm] = useState(initial ? { ...initial, password: "" } : empty);
  useEffect(() => { setForm(initial ? { ...initial, password: "" } : empty); /* eslint-disable-next-line */ }, [initial, open]);
  const submit = async () => {
    try {
      if (isEdit) {
        await api.put(`/users/${initial.id}`, { name: form.name, email: form.email, role: form.role, active: form.active });
      } else {
        await api.post("/users", form);
      }
      toast.success("Tersimpan");
      setOpen(false);
      onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Ubah" : "Tambah"} Pengguna</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nama</Label><Input data-testid="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Username</Label><Input data-testid="u-username" disabled={isEdit} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          {!isEdit && <div><Label>Password</Label><Input data-testid="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>}
          <div><Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Aktif</Label></div>
        </div>
        <DialogFooter><Button data-testid="u-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const [items, setItems] = useState([]);
  const load = async () => {
    const { data } = await api.get("/users");
    setItems(data);
  };
  useEffect(() => { load(); }, []);
  const del = async (id) => {
    if (!window.confirm("Hapus pengguna ini?")) return;
    await api.delete(`/users/${id}`); load();
  };
  return (
    <div>
      <PageHeader
        title="Pengguna"
        subtitle="Kelola akun pengguna RelayLab Production OS."
        actions={<EditDialog isEdit={false} onSaved={load} trigger={<Button data-testid="new-user-btn" className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4 mr-2" />Tambah Pengguna</Button>} />}
      />
      <Section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="font-mono">{u.username}</TableCell>
                <TableCell>{u.email || "-"}</TableCell>
                <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                <TableCell>{u.active ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">Aktif</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">Nonaktif</Badge>}</TableCell>
                <TableCell className="space-x-1">
                  <EditDialog initial={u} isEdit onSaved={load} trigger={<Button size="sm" variant="outline"><Pencil className="w-3 h-3" /></Button>} />
                  <Button size="sm" variant="outline" onClick={() => del(u.id)}><Trash2 className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
