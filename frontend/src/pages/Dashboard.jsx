import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Plus, Workflow, Scissors, Wrench, ShieldCheck, CheckCircle2,
  AlertTriangle, FileBox,
} from "lucide-react";
import { fmtDate } from "@/lib/utils-app";

function StatCard({ label, value, icon: Icon, accent = "amber", testid }) {
  const accents = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div data-testid={testid} className="bg-white border border-slate-200 rounded-md shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-md border grid place-items-center ${accents[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 leading-none mono">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div className="text-slate-400">Memuat dashboard...</div>;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan produksi RelayLab Autolight"
        testid="dashboard-title"
        actions={
          <Link to="/work-orders?new=1">
            <Button data-testid="dashboard-new-wo" className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Buat Work Order
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <StatCard label="WO Aktif" value={stats.active} icon={Workflow} accent="amber" testid="stat-active" />
        <StatCard label="Menunggu Cutting" value={stats.menunggu_cutting} icon={Scissors} accent="sky" testid="stat-cutting" />
        <StatCard label="Produksi" value={stats.produksi} icon={Wrench} accent="indigo" testid="stat-produksi" />
        <StatCard label="Menunggu QC" value={stats.menunggu_qc} icon={ShieldCheck} accent="amber" testid="stat-qc" />
        <StatCard label="QC Pass" value={stats.qc_pass} icon={CheckCircle2} accent="emerald" testid="stat-pass" />
        <StatCard label="Rework" value={stats.rework} icon={AlertTriangle} accent="rose" testid="stat-rework" />
        <StatCard label="Selesai" value={stats.selesai} icon={CheckCircle2} accent="slate" testid="stat-selesai" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1 grid grid-cols-3 gap-3">
          <StatCard label="Draft" value={stats.produk_draft} icon={FileBox} accent="slate" testid="stat-prod-draft" />
          <StatCard label="Trial" value={stats.produk_trial} icon={FileBox} accent="sky" testid="stat-prod-trial" />
          <StatCard label="Released" value={stats.produk_released} icon={FileBox} accent="emerald" testid="stat-prod-released" />
        </div>
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-md p-4">
          <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Prinsip Produksi</div>
          <p className="text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-amber-700">Function First, Color Second.</span>{" "}
            Identitas utama kabel adalah <span className="font-mono text-slate-800">kode fungsi + ukuran + panjang</span>.
            Warna kabel boleh disubstitusi per batch tanpa mengubah resep produk, selama ukuran dan fungsi tetap sama.
            Warna kabel <strong>Power (merah)</strong> dan <strong>Ground (hitam)</strong> akan memberi peringatan saat disubstitusi.
          </p>
        </div>
      </div>

      <Section title="Work Order Terbaru" action={<Link to="/work-orders" className="text-sm text-amber-700 hover:underline">Lihat semua</Link>}>
        {stats.recent.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">Belum ada Work Order. Buat WO pertama Anda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO Number</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Reseller</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent.map((wo) => (
                <TableRow key={wo.wo_number} data-testid={`dashboard-wo-${wo.wo_number}`}>
                  <TableCell>
                    <Link to={`/work-orders/${wo.wo_number}`} className="text-amber-700 hover:underline font-mono">
                      {wo.wo_number}
                    </Link>
                  </TableCell>
                  <TableCell>{fmtDate(wo.tanggal)}</TableCell>
                  <TableCell>{wo.reseller || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{wo.product_sku}</TableCell>
                  <TableCell className="text-right mono">{wo.qty}</TableCell>
                  <TableCell><StatusBadge status={wo.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
