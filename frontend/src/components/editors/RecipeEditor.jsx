import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function RecipeEditor({ product, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [cableOpts, setCableOpts] = useState([]);
  const [bundleOpts, setBundleOpts] = useState([]);
  const [confirmReleased, setConfirmReleased] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, cf, b] = await Promise.all([
        api.get(`/products/${product.sku}/recipe`),
        api.get(`/cable-functions`),
        api.get(`/products/${product.sku}/bundles`),
      ]);
      setRows(r.data.map((x) => ({ ...x })));
      setCableOpts(cf.data);
      setBundleOpts(b.data);
    })();
  }, [product.sku]);

  const addRow = () => {
    setRows([...rows, {
      cable_code: "", qty_per_pcs: 1, bundle_code: bundleOpts[0]?.bundle_code || "A",
      urutan: rows.length + 1, skun_a: "", skun_b: "", perlu_solder: false, catatan_proses: "",
    }]);
  };
  const updateRow = (i, patch) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const delRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const doSave = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r, i) => ({
        product_sku: product.sku,
        cable_code: r.cable_code, qty_per_pcs: Number(r.qty_per_pcs) || 1,
        bundle_code: r.bundle_code, urutan: Number(r.urutan) || i + 1,
        skun_a: r.skun_a || null, skun_b: r.skun_b || null,
        perlu_solder: !!r.perlu_solder, catatan_proses: r.catatan_proses || null,
      }));
      // basic validation
      for (const r of payload) {
        if (!r.cable_code) { toast.error("Setiap baris harus punya cable_code"); setSaving(false); return; }
        if (!r.bundle_code) { toast.error("Setiap baris harus punya bundle_code"); setSaving(false); return; }
      }
      await api.put(`/products/${product.sku}/recipe`, payload);
      toast.success("Recipe disimpan. Revisi otomatis dicatat.");
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  const trySave = () => {
    if (product.status === "Released") setConfirmReleased(true);
    else doSave();
  };

  return (
    <div data-testid="recipe-editor">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500">
          {rows.length} kabel dalam recipe.
          {product.status === "Released" && (
            <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200 border">
              <AlertTriangle className="w-3 h-3 mr-1" />Produk Released
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow} data-testid="recipe-add-row"><Plus className="w-4 h-4 mr-1" />Tambah Kabel</Button>
          <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Batal</Button>
          <Button size="sm" disabled={saving} onClick={trySave} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="recipe-save"><Save className="w-4 h-4 mr-1" />Simpan</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Urutan</TableHead>
            <TableHead>Cable Code</TableHead>
            <TableHead className="w-20">Qty/pcs</TableHead>
            <TableHead className="w-24">Bundle</TableHead>
            <TableHead>Skun A</TableHead>
            <TableHead>Skun B</TableHead>
            <TableHead className="w-20">Solder</TableHead>
            <TableHead>Catatan</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} data-testid={`recipe-edit-row-${i}`}>
              <TableCell><Input type="number" className="h-8 w-14" value={r.urutan} onChange={(e) => updateRow(i, { urutan: e.target.value })} /></TableCell>
              <TableCell>
                <Select value={r.cable_code} onValueChange={(v) => updateRow(i, { cable_code: v })}>
                  <SelectTrigger className="h-8 min-w-[180px]" data-testid={`recipe-cable-${i}`}><SelectValue placeholder="Pilih kabel" /></SelectTrigger>
                  <SelectContent>
                    {cableOpts.map((c) => (
                      <SelectItem key={c.cable_code} value={c.cable_code}>
                        <span className="font-mono">{c.cable_code}</span> — {c.nama_fungsi} ({c.ukuran_kabel}, {c.panjang_cm}cm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input type="number" className="h-8 w-16" value={r.qty_per_pcs} onChange={(e) => updateRow(i, { qty_per_pcs: e.target.value })} /></TableCell>
              <TableCell>
                <Select value={r.bundle_code} onValueChange={(v) => updateRow(i, { bundle_code: v })}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bundleOpts.map((b) => <SelectItem key={b.bundle_code} value={b.bundle_code}>{b.bundle_code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input className="h-8" value={r.skun_a || ""} onChange={(e) => updateRow(i, { skun_a: e.target.value })} /></TableCell>
              <TableCell><Input className="h-8" value={r.skun_b || ""} onChange={(e) => updateRow(i, { skun_b: e.target.value })} /></TableCell>
              <TableCell><Switch checked={!!r.perlu_solder} onCheckedChange={(v) => updateRow(i, { perlu_solder: v })} /></TableCell>
              <TableCell><Input className="h-8" value={r.catatan_proses || ""} onChange={(e) => updateRow(i, { catatan_proses: e.target.value })} /></TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => delRow(i)} data-testid={`recipe-del-${i}`}><Trash2 className="w-3 h-3" /></Button></TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-6">Belum ada kabel. Klik &quot;Tambah Kabel&quot;.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <AlertDialog open={confirmReleased} onOpenChange={setConfirmReleased}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />Produk Sudah Released</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{product.sku}</strong> berstatus Released. Perubahan resep langsung dapat memengaruhi WO yang akan datang.
              <br /><br />
              Sebaiknya buat <strong>versi baru</strong> (mis. {product.versi}.1) dengan SKU varian, lalu approve setelah trial.
              Lanjutkan tetap menyimpan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="bg-amber-600 hover:bg-amber-700" data-testid="recipe-confirm-save">Tetap Simpan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
