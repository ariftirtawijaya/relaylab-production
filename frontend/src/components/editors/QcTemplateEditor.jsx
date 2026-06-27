import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function QcTemplateEditor({ product, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [confirmReleased, setConfirmReleased] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/products/${product.sku}/qc-template`).then((r) => {
      setItems((r.data.items || []).map((x) => ({ ...x })));
    });
  }, [product.sku]);

  const add = () => {
    setItems([...items, {
      id: "tmp-" + Math.random().toString(36).slice(2, 8),
      nama: "", cara_tes: "", expected: "", required: true, urutan: items.length + 1,
    }]);
  };
  const update = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const del = (i) => setItems(items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, urutan: idx + 1 })));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setItems(arr.map((it, idx) => ({ ...it, urutan: idx + 1 })));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const payload = {
        product_sku: product.sku,
        items: items.map((it, i) => ({
          id: it.id?.startsWith("tmp-") ? undefined : it.id,
          nama: it.nama, cara_tes: it.cara_tes || null,
          expected: it.expected || null, required: !!it.required, urutan: i + 1,
        })),
      };
      for (const it of payload.items) {
        if (!it.nama) { toast.error("Nama item QC wajib"); setSaving(false); return; }
      }
      await api.put(`/products/${product.sku}/qc-template`, payload);
      toast.success("QC Template disimpan. Revisi otomatis dicatat.");
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };
  const trySave = () => product.status === "Released" ? setConfirmReleased(true) : doSave();

  return (
    <div data-testid="qc-editor">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500">{items.length} item QC.</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={add} data-testid="qc-add"><Plus className="w-4 h-4 mr-1" />Item Baru</Button>
          <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Batal</Button>
          <Button size="sm" disabled={saving} onClick={trySave} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="qc-tpl-save"><Save className="w-4 h-4 mr-1" />Simpan</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Nama Item</TableHead>
            <TableHead>Cara Tes</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead className="w-20">Wajib</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, i) => (
            <TableRow key={it.id} data-testid={`qc-item-${i}`}>
              <TableCell className="mono">{i + 1}</TableCell>
              <TableCell><Input className="h-8" value={it.nama} onChange={(e) => update(i, { nama: e.target.value })} placeholder="cth: Visual crimping" /></TableCell>
              <TableCell><Input className="h-8" value={it.cara_tes || ""} onChange={(e) => update(i, { cara_tes: e.target.value })} /></TableCell>
              <TableCell><Input className="h-8" value={it.expected || ""} onChange={(e) => update(i, { expected: e.target.value })} /></TableCell>
              <TableCell><Switch checked={!!it.required} onCheckedChange={(v) => update(i, { required: v })} /></TableCell>
              <TableCell className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => del(i)}><Trash2 className="w-3 h-3" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Belum ada item QC.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <AlertDialog open={confirmReleased} onOpenChange={setConfirmReleased}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />Produk Released</AlertDialogTitle>
            <AlertDialogDescription>
              Mengubah template QC pada produk Released akan memengaruhi standar pengujian WO selanjutnya. Disarankan buat versi baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="bg-amber-600 hover:bg-amber-700">Tetap Simpan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
