import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { fmtDate } from "@/lib/utils-app";
import ProductionBriefing, { ChangedBadge, cableChangeKind } from "@/components/ProductionBriefing";

export default function CuttingSheetPrint() {
  const { woNumber } = useParams();
  const [data, setData] = useState(null);
  const [wo, setWo] = useState(null);
  useEffect(() => {
    api.get(`/work-orders/${woNumber}/cutting-sheet`).then((r) => setData(r.data));
    api.get(`/work-orders/${woNumber}`).then((r) => setWo(r.data));
  }, [woNumber]);
  if (!data || !wo) return <div className="p-8">Memuat...</div>;
  const { product, rows } = data;

  return (
    <div className="print-area p-8 max-w-5xl mx-auto bg-white text-slate-900">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak</Button>
      </div>
      <header className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-600">RelayLab Production System</div>
            <h1 className="text-2xl font-bold">CUTTING SHEET</h1>
          </div>
          <div className="text-right text-sm">
            <div><strong>WO:</strong> <span className="font-mono">{wo.wo_number}</span></div>
            <div><strong>Tanggal:</strong> {fmtDate(wo.tanggal)}</div>
            {wo.deadline && <div><strong>Deadline:</strong> {fmtDate(wo.deadline)}</div>}
          </div>
        </div>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div><div className="text-xs text-slate-500 uppercase">SKU</div><div className="font-mono">{wo.product_sku}</div></div>
        <div><div className="text-xs text-slate-500 uppercase">Produk</div><div>{product?.nama_pendek || product?.nama_produk}</div></div>
        <div><div className="text-xs text-slate-500 uppercase">Reseller</div><div>{wo.reseller || "-"}</div></div>
        <div><div className="text-xs text-slate-500 uppercase">Qty Order</div><div className="font-bold text-lg">{wo.qty} pcs</div></div>
      </div>

      <ProductionBriefing briefing={wo.briefing} sku={wo.product_sku} />

      <div className="text-xs text-slate-600 italic mb-2 no-print-text-only">
        Urutan baris: <strong>ukuran kabel</strong> → <strong>warna aktual</strong> → cable code. Potong batch per kelompok untuk efisiensi.
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-black p-2 text-left">Cable Code</th>
            <th className="border border-black p-2 text-left">Fungsi</th>
            <th className="border border-black p-2">Ukuran</th>
            <th className="border border-black p-2">Panjang</th>
            <th className="border border-black p-2">Qty/pcs</th>
            <th className="border border-black p-2">Total</th>
            <th className="border border-black p-2">Warna Default</th>
            <th className="border border-black p-2">Warna Aktual</th>
            <th className="border border-black p-2">Program</th>
            <th className="border border-black p-2">Bundle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const ck = cableChangeKind(wo.briefing, r.cable_code);
            const prev = idx > 0 ? rows[idx - 1] : null;
            const newUkuran = !prev || prev.ukuran_kabel !== r.ukuran_kabel;
            const newWarna = !prev || (prev.warna_aktual || "").toLowerCase() !== (r.warna_aktual || "").toLowerCase();
            return (
              <React.Fragment key={r.cable_code}>
                {newUkuran && idx > 0 && (
                  <tr className="cs-group-sep"><td colSpan={10} className="border-t-2 border-black h-0 p-0"></td></tr>
                )}
                <tr data-testid={`cs-row-${r.cable_code}`} className={`${r.substitusi ? "bg-amber-50" : ""} ${ck ? "border-l-4 border-l-amber-500" : ""}`}>
                  <td className="border border-black p-2 font-mono font-semibold">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{r.cable_code}</span>
                      {ck && <ChangedBadge kind={ck} />}
                    </div>
                  </td>
                  <td className="border border-black p-2">{r.nama_fungsi}</td>
                  <td className={`border border-black p-2 font-mono text-center ${newUkuran ? "font-bold" : "text-slate-500"}`}>{r.ukuran_kabel}</td>
                  <td className="border border-black p-2 font-mono text-center">{r.panjang_cm} cm</td>
                  <td className="border border-black p-2 text-center font-mono">{r.qty_per_pcs}</td>
                  <td className="border border-black p-2 text-center font-mono font-bold">{r.total_qty}</td>
                  <td className="border border-black p-2">{r.warna_default || "-"}</td>
                  <td className={`border border-black p-2 ${newWarna ? "font-bold" : ""}`}>
                    {r.warna_aktual}
                    {r.substitusi && <div className="text-xs italic">substitusi</div>}
                  </td>
                  <td className="border border-black p-2 font-mono text-center">{r.nomor_program || "-"}</td>
                  <td className="border border-black p-2 font-mono text-center">{r.bundle_code}</td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-12 mt-12 text-sm">
        <div className="text-center">
          <div className="border-t border-black pt-1 mt-12">Cutting Operator</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-1 mt-12">Production Leader</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-1 mt-12">Admin / Owner</div>
        </div>
      </div>
    </div>
  );
}
