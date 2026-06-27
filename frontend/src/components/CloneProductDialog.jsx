import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GitBranch, Copy } from "lucide-react";
import { toast } from "sonner";

export default function CloneProductDialog({ product, open, setOpen, onCloned }) {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    new_sku: "", new_nama_produk: "", new_versi: "V2",
    new_status: "Draft", catatan: "",
    copy_recipe: true, copy_bundles: true, copy_work_instructions: true,
    copy_pin_map: true, copy_qc_template: true, copy_common_mistakes: true,
    hold_old: false,
  });

  useEffect(() => {
    if (open && product?.sku) {
      api.get(`/products/${product.sku}/suggest-version`).then((r) => {
        setForm((f) => ({
          ...f,
          new_sku: r.data.new_sku,
          new_versi: r.data.new_versi,
          new_nama_produk: r.data.new_nama_produk,
        }));
      });
    }
  }, [open, product?.sku]);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/products/${product.sku}/clone`, form);
      const counts = Object.entries(data.copied || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
      toast.success(`Produk ${data.product.sku} dibuat. Disalin — ${counts || "tidak ada"}`);
      setOpen(false);
      onCloned?.(data.product);
      nav(`/products/${data.product.sku}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal clone produk");
    } finally {
      setLoading(false);
    }
  };

  function renderOption(k, label) {
    return (
      <label className="flex items-center gap-2 text-sm cursor-pointer" key={k}>
        <Checkbox
          data-testid={`clone-opt-${k}`}
          checked={!!form[k]}
          onCheckedChange={(v) => setForm({ ...form, [k]: !!v })}
        />
        {label}
      </label>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5 text-amber-600" />Buat Versi Baru / Clone Produk</DialogTitle>
          <DialogDescription>
            Salin produk <span className="font-mono">{product?.sku}</span> ke SKU baru.
            Recipe, bundle, instruction, pin map, dan QC akan disalin sesuai pilihan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SKU Baru</Label>
              <Input data-testid="clone-sku" value={form.new_sku} onChange={(e) => setForm({ ...form, new_sku: e.target.value })} />
            </div>
            <div>
              <Label>Versi Baru</Label>
              <Input data-testid="clone-versi" value={form.new_versi} onChange={(e) => setForm({ ...form, new_versi: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Nama Produk Baru</Label>
              <Input data-testid="clone-nama" value={form.new_nama_produk} onChange={(e) => setForm({ ...form, new_nama_produk: e.target.value })} />
            </div>
            <div>
              <Label>Status Produk Baru</Label>
              <Select value={form.new_status} onValueChange={(v) => setForm({ ...form, new_status: v })}>
                <SelectTrigger data-testid="clone-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Catatan Perubahan</Label>
              <Textarea data-testid="clone-catatan" rows={2} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="cth: Variasi panjang kabel low beam untuk Honda Brio facelift." />
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2 flex items-center gap-1.5">
              <Copy className="w-3 h-3" />Yang Disalin
            </div>
            <div className="grid grid-cols-2 gap-2">
              {renderOption("copy_recipe", "Salin Recipe (kabel)")}
              {renderOption("copy_bundles", "Salin Bundle")}
              {renderOption("copy_work_instructions", "Salin Work Instruction")}
              {renderOption("copy_pin_map", "Salin Relay Pin Map")}
              {renderOption("copy_qc_template", "Salin QC Template")}
              {renderOption("copy_common_mistakes", "Salin Common Mistakes")}
            </div>
          </div>

          <div className="border border-amber-200 rounded-md p-3 bg-amber-50">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                data-testid="clone-hold-old"
                checked={!!form.hold_old}
                onCheckedChange={(v) => setForm({ ...form, hold_old: !!v })}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-amber-900">Tandai produk lama sebagai Hold</div>
                <div className="text-xs text-amber-800">Cocok jika versi baru menggantikan versi lama. Default: nonaktif.</div>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button
            data-testid="clone-submit"
            disabled={loading || !form.new_sku || !form.new_nama_produk}
            onClick={submit}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? "Memproses..." : "Buat Versi Baru"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
