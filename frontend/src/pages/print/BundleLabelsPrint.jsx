import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { bundleChangeKind } from "@/components/ProductionBriefing";

export default function BundleLabelsPrint() {
  const { woNumber } = useParams();
  const [data, setData] = useState(null);
  const [wo, setWo] = useState(null);

  useEffect(() => {
    api.get(`/work-orders/${woNumber}/bundles`).then((r) => setData(r.data));
    api.get(`/work-orders/${woNumber}`).then((r) => setWo(r.data));
  }, [woNumber]);

  if (!data || !wo) return <div className="p-8">Memuat...</div>;
  const { bundles } = data;
  const baseUrl = window.location.origin;

  return (
    <div className="print-area p-6 max-w-5xl mx-auto bg-white text-slate-900">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak Semua</Button>
      </div>
      <div className="grid grid-cols-2 gap-4 print:grid-cols-2">
        {bundles.map((b) => {
          const qrUrl = `${baseUrl}/work-orders/${wo.wo_number}/bundles/${b.bundle_code}`;
          const changed = bundleChangeKind(wo.briefing, b.bundle_code);
          return (
            <div key={b.bundle_code} className={`bundle-label border-2 p-3 break-inside-avoid ${changed ? "border-amber-600" : "border-black"}`}>
              <div className="flex justify-between items-start border-b border-black pb-1 mb-2">
                <div>
                  <div className="text-xs font-mono text-slate-600">{wo.wo_number}</div>
                  <div className="text-xs">{wo.product_sku}</div>
                  <div className="font-bold text-base leading-tight">
                    BUNDLE {b.bundle_code} — {(b.bundle_name || "").toUpperCase()}
                  </div>
                  {changed && (
                    <div className="inline-block text-[10px] font-bold mt-0.5 px-1.5 py-0.5 border border-amber-600 bg-amber-100 text-amber-900 rounded">
                      BERUBAH vs {wo.briefing.compared_to_sku}
                    </div>
                  )}
                  <div className="text-xs italic mt-0.5">Qty: {wo.qty} set</div>
                </div>
                <QRCodeSVG value={qrUrl} size={70} />
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black px-1 py-0.5 text-left">Cable</th>
                    <th className="border border-black px-1 py-0.5">Ukuran</th>
                    <th className="border border-black px-1 py-0.5">Panjang</th>
                    <th className="border border-black px-1 py-0.5">Warna</th>
                    <th className="border border-black px-1 py-0.5">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {b.cables.map((c) => (
                    <tr key={c.cable_code}>
                      <td className="border border-black px-1 py-0.5 font-mono">{c.cable_code}</td>
                      <td className="border border-black px-1 py-0.5 font-mono text-center">{c.ukuran_kabel}</td>
                      <td className="border border-black px-1 py-0.5 font-mono text-center">{c.panjang_cm}cm</td>
                      <td className="border border-black px-1 py-0.5">{c.warna || "-"}</td>
                      <td className="border border-black px-1 py-0.5 text-center font-mono">x{c.total_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {b.instruksi_singkat && <div className="text-xs mt-2 leading-snug">{b.instruksi_singkat}</div>}
              {b.target_relay_pin && <div className="text-xs mt-1 font-semibold">Target: {b.target_relay_pin}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
