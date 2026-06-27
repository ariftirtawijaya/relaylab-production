import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PinMapPrint() {
  const { woNumber } = useParams();
  const [wo, setWo] = useState(null);
  const [pinMap, setPinMap] = useState([]);
  useEffect(() => {
    (async () => {
      const { data: w } = await api.get(`/work-orders/${woNumber}`);
      setWo(w);
      const { data: pm } = await api.get(`/products/${w.product_sku}/pin-map`);
      setPinMap(pm);
    })();
  }, [woNumber]);
  if (!wo) return <div className="p-8">Memuat...</div>;
  return (
    <div className="print-area p-8 max-w-4xl mx-auto bg-white text-slate-900">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2" />Cetak</Button>
      </div>
      <header className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-600">RelayLab Production System</div>
            <h1 className="text-2xl font-bold">RELAY PIN MAP</h1>
          </div>
          <div className="text-right text-sm">
            <div><strong>WO:</strong> <span className="font-mono">{wo.wo_number}</span></div>
            <div><strong>SKU:</strong> <span className="font-mono">{wo.product_sku}</span></div>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {pinMap.map((r) => (
          <div key={r.relay_number} className="border border-black p-3">
            <div className="flex justify-between items-baseline mb-2">
              <div>
                <span className="text-xs text-slate-500">Relay {r.relay_number} — </span>
                <span className="font-bold text-lg">{r.relay_name}</span>
              </div>
              <span className="text-xs font-mono border border-black px-2 py-0.5">{r.relay_type}</span>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-2 w-20">Pin</th>
                  <th className="border border-black p-2">Cable Code</th>
                  <th className="border border-black p-2 text-left">Fungsi</th>
                </tr>
              </thead>
              <tbody>
                {r.pins.map((p) => (
                  <tr key={p.pin_number}>
                    <td className="border border-black p-2 text-center font-mono font-bold">{p.pin_number}</td>
                    <td className="border border-black p-2 text-center font-mono">{p.cable_code || "-"}</td>
                    <td className="border border-black p-2">{p.fungsi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
