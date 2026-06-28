import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, Pencil, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import WorkInstructionEditor from "./WorkInstructionEditor";
import ImageUploader from "../ImageUploader";

const empty = { bundle_code: "", bundle_name: "", fungsi_bundle: "", instruksi_singkat: "", target_relay_pin: "", urutan: 0 };

function BundleDialog({ open, setOpen, initial, onSave }) {
  const [f, setF] = useState(empty);
  useEffect(() => { setF(initial || empty); }, [initial, open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Ubah Bundle" : "Bundle Baru"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bundle Code</Label><Input data-testid="bd-code" value={f.bundle_code} onChange={(e) => setF({ ...f, bundle_code: e.target.value.toUpperCase() })} placeholder="A" /></div>
          <div><Label>Urutan</Label><Input type="number" value={f.urutan} onChange={(e) => setF({ ...f, urutan: e.target.value })} /></div>
          <div className="col-span-2"><Label>Bundle Name</Label><Input data-testid="bd-name" value={f.bundle_name} onChange={(e) => setF({ ...f, bundle_name: e.target.value })} placeholder="Devil Output" /></div>
          <div className="col-span-2"><Label>Fungsi Bundle</Label><Input value={f.fungsi_bundle || ""} onChange={(e) => setF({ ...f, fungsi_bundle: e.target.value })} /></div>
          <div className="col-span-2"><Label>Target Relay Pin</Label><Input value={f.target_relay_pin || ""} onChange={(e) => setF({ ...f, target_relay_pin: e.target.value })} placeholder="Relay 1 pin 87" /></div>
          <div className="col-span-2"><Label>Instruksi Singkat</Label><Textarea value={f.instruksi_singkat || ""} onChange={(e) => setF({ ...f, instruksi_singkat: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button data-testid="bd-save" onClick={() => { if (!f.bundle_code || !f.bundle_name) { toast.error("Code & Name wajib"); return; } onSave(f); setOpen(false); }} className="bg-amber-600 hover:bg-amber-700">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BundleEditor({ product, onClose, onSaved }) {
  const [bundles, setBundles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmReleased, setConfirmReleased] = useState(false);
  const [wiBundle, setWiBundle] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/products/${product.sku}/bundles`).then((r) => setBundles(r.data));
  }, [product.sku]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (b) => { setEditing(b); setDialogOpen(true); };
  const onSaveDialog = (data) => {
    if (editing) {
      setBundles(bundles.map((b) => b.bundle_code === editing.bundle_code ? { ...b, ...data, urutan: Number(data.urutan) || b.urutan } : b));
    } else {
      if (bundles.some((b) => b.bundle_code === data.bundle_code)) { toast.error("Bundle code sudah ada"); return; }
      setBundles([...bundles, { ...data, urutan: Number(data.urutan) || bundles.length + 1, product_sku: product.sku }]);
    }
  };
  const del = (code) => {
    if (!window.confirm(`Hapus bundle ${code}?`)) return;
    setBundles(bundles.filter((b) => b.bundle_code !== code));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const payload = bundles.map((b, i) => ({
        product_sku: product.sku,
        bundle_code: b.bundle_code, bundle_name: b.bundle_name,
        fungsi_bundle: b.fungsi_bundle || null,
        instruksi_singkat: b.instruksi_singkat || null,
        target_relay_pin: b.target_relay_pin || null,
        urutan: Number(b.urutan) || i + 1,
        foto_url: b.foto_url || null,
      }));
      await api.put(`/products/${product.sku}/bundles`, payload);
      toast.success("Bundle disimpan. Revisi otomatis dicatat.");
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };
  const trySave = () => product.status === "Released" ? setConfirmReleased(true) : doSave();

  if (wiBundle) {
    return (
      <WorkInstructionEditor
        product={product}
        bundle={wiBundle}
        onClose={() => setWiBundle(null)}
        onSaved={() => setWiBundle(null)}
      />
    );
  }

  const sorted = [...bundles].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

  return (
    <div data-testid="bundle-editor">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500">{bundles.length} bundle.</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openNew} data-testid="bundle-add"><Plus className="w-4 h-4 mr-1" />Bundle Baru</Button>
          <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Batal</Button>
          <Button size="sm" disabled={saving} onClick={trySave} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="bundle-save"><Save className="w-4 h-4 mr-1" />Simpan</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((b) => (
          <div key={b.bundle_code} className="border border-slate-200 rounded-md p-3 bg-white" data-testid={`bundle-edit-${b.bundle_code}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 grid place-items-center bg-amber-100 text-amber-800 font-bold rounded-md">{b.bundle_code}</div>
                <div>
                  <div className="font-semibold">{b.bundle_name}</div>
                  <div className="text-xs text-slate-500">Urutan: {b.urutan} {b.fungsi_bundle && `· ${b.fungsi_bundle}`}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setWiBundle(b)} data-testid={`bundle-wi-${b.bundle_code}`}><FileText className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}><Pencil className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => del(b.bundle_code)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
            {b.instruksi_singkat && <div className="text-xs text-slate-600 mt-2 border-t pt-2">{b.instruksi_singkat}</div>}
            {b.target_relay_pin && <div className="text-xs text-amber-700 mt-1">Target: <span className="font-mono">{b.target_relay_pin}</span></div>}
            {b.id && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <ImageUploader
                  relatedType="bundle"
                  relatedId={b.id}
                  productSku={product.sku}
                  canUpload={true}
                  title={`Foto Referensi Bundle ${b.bundle_code}`}
                  compact
                  emptyHint="Belum ada foto referensi."
                  max={6}
                  testIdPrefix={`bundle-photo-${b.bundle_code}`}
                />
              </div>
            )}
            {!b.id && <div className="mt-2 text-xs text-slate-400 italic">Simpan dulu untuk bisa upload foto.</div>}
          </div>
        ))}
        {bundles.length === 0 && <div className="col-span-2 text-center text-slate-500 py-8">Belum ada bundle.</div>}
      </div>

      <BundleDialog open={dialogOpen} setOpen={setDialogOpen} initial={editing} onSave={onSaveDialog} />

      <AlertDialog open={confirmReleased} onOpenChange={setConfirmReleased}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />Produk Released</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan bundle pada <strong>{product.sku}</strong> akan memengaruhi cutting sheet & bundle label WO selanjutnya.
              Disarankan buat versi baru. Lanjutkan?
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
