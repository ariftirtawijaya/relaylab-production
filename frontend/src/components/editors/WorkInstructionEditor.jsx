import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, X, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ImageUploader from "../ImageUploader";

export default function WorkInstructionEditor({ product, bundle, onClose, onSaved }) {
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/products/${product.sku}/work-instructions/${bundle.bundle_code}`).then((r) => {
      const initial = (r.data.steps || []).map((s, i) => ({
        step_number: s.step_number || i + 1,
        instruksi: s.instruksi || "",
        komponen: s.komponen || "",
        tools: s.tools || "",
        safety: s.safety || "",
        foto_url: s.foto_url || "",
        common_mistake: s.common_mistake || "",
      }));
      setSteps(initial);
    });
  }, [product.sku, bundle.bundle_code]);

  const addStep = () => {
    setSteps([...steps, {
      step_number: steps.length + 1, instruksi: "", komponen: "", tools: "", safety: "", foto_url: "", common_mistake: "",
    }]);
  };
  const update = (i, patch) => setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const del = (i) => setSteps(steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const arr = [...steps];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSteps(arr.map((s, idx) => ({ ...s, step_number: idx + 1 })));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const payload = {
        product_sku: product.sku,
        bundle_code: bundle.bundle_code,
        steps: steps.map((s, i) => ({
          step_number: i + 1,
          instruksi: s.instruksi,
          komponen: s.komponen || null,
          tools: s.tools || null,
          safety: s.safety || null,
          foto_url: s.foto_url || null,
          common_mistake: s.common_mistake || null,
        })),
      };
      for (const s of payload.steps) {
        if (!s.instruksi) { toast.error("Setiap step butuh instruksi"); setSaving(false); return; }
      }
      await api.put(`/products/${product.sku}/work-instructions/${bundle.bundle_code}`, payload);
      toast.success("Work Instruction disimpan. Revisi otomatis dicatat.");
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
    finally { setSaving(false); }
  };

  return (
    <div data-testid="wi-editor">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm">
          <div className="font-semibold">Work Instruction · Bundle {bundle.bundle_code} — {bundle.bundle_name}</div>
          <div className="text-xs text-slate-500">{steps.length} step.</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addStep} data-testid="wi-add-step"><Plus className="w-4 h-4 mr-1" />Tambah Step</Button>
          <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Batal</Button>
          <Button size="sm" disabled={saving} onClick={doSave} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="wi-save"><Save className="w-4 h-4 mr-1" />Simpan</Button>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="border border-slate-200 rounded-md p-3 bg-white" data-testid={`wi-step-${i}`}>
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 grid place-items-center bg-amber-100 text-amber-800 font-bold rounded-md font-mono">#{i + 1}</div>
              <Textarea data-testid={`wi-instr-${i}`} className="flex-1" rows={2} placeholder="Instruksi step..." value={s.instruksi} onChange={(e) => update(i, { instruksi: e.target.value })} />
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === steps.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => del(i)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
            <div className="ml-13 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><Label className="text-xs">Komponen</Label><Input className="h-8" value={s.komponen} onChange={(e) => update(i, { komponen: e.target.value })} placeholder="cth: DEV-OUT-S" /></div>
              <div><Label className="text-xs">Tools</Label><Input className="h-8" value={s.tools} onChange={(e) => update(i, { tools: e.target.value })} placeholder="Crimping tool" /></div>
              <div><Label className="text-xs"><AlertTriangle className="w-3 h-3 inline mr-1 text-amber-600" />Safety</Label><Input className="h-8" value={s.safety} onChange={(e) => update(i, { safety: e.target.value })} /></div>
              <div><Label className="text-xs">Common Mistake</Label><Input className="h-8" value={s.common_mistake} onChange={(e) => update(i, { common_mistake: e.target.value })} /></div>
              <div className="col-span-2 md:col-span-4"><Label className="text-xs">Foto URL Eksternal (opsional, legacy)</Label><Input className="h-8" value={s.foto_url} onChange={(e) => update(i, { foto_url: e.target.value })} placeholder="https://..." /></div>
              <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-slate-100">
                <ImageUploader
                  relatedType="work_instruction_step"
                  relatedId={`${product.sku}:${bundle.bundle_code}:${i + 1}`}
                  productSku={product.sku}
                  canUpload={true}
                  title={`Foto Step ${i + 1}`}
                  compact
                  emptyHint="Belum ada foto step."
                  max={4}
                  testIdPrefix={`wi-step-photo-${i}`}
                />
              </div>
            </div>
          </div>
        ))}
        {steps.length === 0 && <div className="text-center text-slate-500 py-8">Belum ada step. Klik &quot;Tambah Step&quot;.</div>}
      </div>
    </div>
  );
}
