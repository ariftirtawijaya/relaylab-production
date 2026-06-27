import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { fmtDate } from "@/lib/utils-app";

export default function QcChecklistPrint() {
  const { woNumber } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/work-orders/${woNumber}/qc`).then((r) => setData(r.data));
  }, [woNumber]);
  if (!data) return <div className="p-8">Memuat...</div>;
  const { template, result, wo } = data;
  const items = template.items || [];

  return (
    <div className="print-area p-8 max-w-3xl mx-auto bg-white text-slate-900">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak</Button>
      </div>
      <header className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-600">RelayLab Production OS</div>
            <h1 className="text-2xl font-bold">QC CHECKLIST</h1>
          </div>
          <div className="text-right text-sm">
            <div><strong>WO:</strong> <span className="font-mono">{wo.wo_number}</span></div>
            <div><strong>SKU:</strong> <span className="font-mono">{wo.product_sku}</span></div>
            <div><strong>Qty:</strong> {wo.qty}</div>
            <div><strong>Tanggal:</strong> {fmtDate(wo.tanggal)}</div>
          </div>
        </div>
      </header>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-black p-2 w-10">#</th>
            <th className="border border-black p-2 text-left">Item Tes</th>
            <th className="border border-black p-2 text-left">Cara Tes</th>
            <th className="border border-black p-2 text-left">Expected</th>
            <th className="border border-black p-2 w-16">Pass</th>
            <th className="border border-black p-2 w-16">Fail</th>
            <th className="border border-black p-2 text-left">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const r = (result?.items || []).find((x) => x.item_id === it.id);
            return (
              <tr key={it.id}>
                <td className="border border-black p-2 text-center font-mono">{i + 1}</td>
                <td className="border border-black p-2">
                  <div className="font-semibold">{it.nama}</div>
                  {it.required && <div className="text-xs italic">(wajib)</div>}
                </td>
                <td className="border border-black p-2 text-xs">{it.cara_tes}</td>
                <td className="border border-black p-2 text-xs">{it.expected}</td>
                <td className="border border-black p-2 text-center text-xl">{r?.pass_fail === "Pass" ? "✓" : ""}</td>
                <td className="border border-black p-2 text-center text-xl">{r?.pass_fail === "Fail" ? "✗" : ""}</td>
                <td className="border border-black p-2 text-xs">{r?.catatan || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {result?.catatan_rework && (
        <div className="mt-4 text-sm">
          <div className="font-semibold">Catatan Rework:</div>
          <div className="border border-black p-2 mt-1">{result.catatan_rework}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-12 mt-12 text-sm">
        <div className="text-center"><div className="border-t border-black pt-1 mt-12">QC Operator</div></div>
        <div className="text-center"><div className="border-t border-black pt-1 mt-12">Production Leader</div></div>
        <div className="text-center"><div className="border-t border-black pt-1 mt-12">Admin / Owner</div></div>
      </div>
    </div>
  );
}
