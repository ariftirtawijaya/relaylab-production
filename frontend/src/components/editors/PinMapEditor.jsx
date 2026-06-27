import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const RELAY_TYPES = ["4 pin", "5 pin"];
const PIN_OPTIONS = { "4 pin": ["30", "85", "86", "87"], "5 pin": ["30", "85", "86", "87", "87a"] };

export default function PinMapEditor({ product, onClose, onSaved }) {
  const [relays, setRelays] = useState([]);
  const [confirmReleased, setConfirmReleased] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/products/${product.sku}/pin-map`).then((r) => {
      setRelays(r.data.map((x) => ({ ...x })));
    });
  }, [product.sku]);

  const addRelay = () => {
    const next = (relays.reduce((m, r) => Math.max(m, r.relay_number), 0)) + 1;
    setRelays([...relays, {
      relay_number: next, relay_name: `Relay ${next}`, relay_type: "4 pin",
      pins: PIN_OPTIONS["4 pin"].map((p) => ({ pin_number: p, cable_code: "", fungsi: "" })),
      catatan: "",
    }]);
  };
  const updateRelay = (i, patch) => {
    setRelays(relays.map((r, idx) => {
      if (idx !== i) return r;
      const merged = { ...r, ...patch };
      if (patch.relay_type && patch.relay_type !== r.relay_type) {
        merged.pins = PIN_OPTIONS[patch.relay_type].map((p) => {
          const existing = (r.pins || []).find((x) => x.pin_number === p);
          return existing || { pin_number: p, cable_code: "", fungsi: "" };
        });
      }
      return merged;
    }));
  };
  const delRelay = (i) => {
    if (!window.confirm("Hapus relay?")) return;
    setRelays(relays.filter((_, idx) => idx !== i));
  };
  const updatePin = (ri, pi, patch) => {
    setRelays(relays.map((r, idx) => {
      if (idx !== ri) return r;
      return { ...r, pins: r.pins.map((p, j) => j === pi ? { ...p, ...patch } : p) };
    }));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const payload = relays.map((r) => ({
        product_sku: product.sku,
        relay_number: Number(r.relay_number) || 1,
        relay_name: r.relay_name,
        relay_type: r.relay_type,
        pins: r.pins.map((p) => ({
          pin_number: p.pin_number, cable_code: p.cable_code || null, fungsi: p.fungsi || null,
          catatan: p.catatan || null,
        })),
        catatan: r.catatan || null,
      }));
      await api.put(`/products/${product.sku}/pin-map`, payload);
      toast.success("Pin Map disimpan. Revisi otomatis dicatat.");
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };
  const trySave = () => product.status === "Released" ? setConfirmReleased(true) : doSave();

  return (
    <div data-testid="pinmap-editor">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500">{relays.length} relay.</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRelay} data-testid="pm-add-relay"><Plus className="w-4 h-4 mr-1" />Tambah Relay</Button>
          <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Batal</Button>
          <Button size="sm" disabled={saving} onClick={trySave} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="pm-save"><Save className="w-4 h-4 mr-1" />Simpan</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {relays.map((r, ri) => (
          <div key={ri} className="border border-slate-200 rounded-md p-3 bg-white" data-testid={`pm-relay-${ri}`}>
            <div className="flex items-start gap-2 mb-3">
              <Input type="number" className="h-8 w-16" value={r.relay_number} onChange={(e) => updateRelay(ri, { relay_number: e.target.value })} />
              <Input className="h-8 flex-1" value={r.relay_name} onChange={(e) => updateRelay(ri, { relay_name: e.target.value })} placeholder="Relay Name" />
              <Select value={r.relay_type} onValueChange={(v) => updateRelay(ri, { relay_type: v })}>
                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{RELAY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => delRelay(ri)}><Trash2 className="w-3 h-3" /></Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pin</TableHead>
                  <TableHead>Cable Code</TableHead>
                  <TableHead>Fungsi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.pins.map((p, pi) => (
                  <TableRow key={pi}>
                    <TableCell><Badge className="font-mono">{p.pin_number}</Badge></TableCell>
                    <TableCell><Input className="h-8 font-mono text-xs" value={p.cable_code || ""} onChange={(e) => updatePin(ri, pi, { cable_code: e.target.value })} /></TableCell>
                    <TableCell><Input className="h-8 text-xs" value={p.fungsi || ""} onChange={(e) => updatePin(ri, pi, { fungsi: e.target.value })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
        {relays.length === 0 && <div className="col-span-2 text-center text-slate-500 py-8">Belum ada relay.</div>}
      </div>

      <AlertDialog open={confirmReleased} onOpenChange={setConfirmReleased}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />Produk Released</AlertDialogTitle>
            <AlertDialogDescription>
              Mengubah pin map produk Released sangat berisiko terhadap fungsi relay. Disarankan buat versi baru.
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
