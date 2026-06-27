import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge, Section } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth, hasRole } from "@/lib/auth";
import { ArrowLeft, CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import { fmtDate } from "@/lib/utils-app";
import { toast } from "sonner";

export default function ProductDetail() {
  const { sku } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [pinMap, setPinMap] = useState([]);
  const [qcTpl, setQcTpl] = useState({ items: [] });
  const [mistakes, setMistakes] = useState([]);
  const [revisions, setRevisions] = useState([]);

  const load = async () => {
    const [p, r, b, pm, qc, m, rev] = await Promise.all([
      api.get(`/products/${sku}`),
      api.get(`/products/${sku}/recipe`),
      api.get(`/products/${sku}/bundles`),
      api.get(`/products/${sku}/pin-map`),
      api.get(`/products/${sku}/qc-template`),
      api.get(`/products/${sku}/common-mistakes`),
      api.get(`/products/${sku}/revisions`),
    ]);
    setProduct(p.data);
    setRecipe(r.data);
    setBundles(b.data);
    setPinMap(pm.data);
    setQcTpl(qc.data);
    setMistakes(m.data);
    setRevisions(rev.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sku]);

  const approve = async () => {
    try {
      const { data } = await api.post(`/products/${sku}/approve`);
      setProduct(data);
      toast.success("Produk di-approve sebagai Released.");
    } catch (e) { toast.error("Gagal"); }
  };

  if (!product) return <div className="text-slate-400">Memuat...</div>;

  return (
    <div>
      <PageHeader
        title={product.nama_produk}
        subtitle={<div className="flex items-center gap-2 font-mono text-sm">{product.sku} <StatusBadge status={product.status} /></div>}
        actions={
          <div className="flex gap-2">
            <Link to="/products"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Kembali</Button></Link>
            {hasRole(user, "Admin") && product.status !== "Released" && (
              <Button data-testid="approve-product" onClick={approve} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="w-4 h-4 mr-2" />Approve Released</Button>
            )}
          </div>
        }
      />

      <Section className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-slate-500 text-xs uppercase">Versi</div><div className="font-mono">{product.versi}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Kategori</div><div>{product.kategori || "-"}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Kapasitas / hari</div><div className="font-mono">{product.kapasitas_normal} pcs</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Approved by</div><div>{product.approved_by || "-"}</div></div>
          <div className="col-span-2 md:col-span-4"><div className="text-slate-500 text-xs uppercase">Konfigurasi</div><div>{product.konfigurasi || "-"}</div></div>
          <div className="col-span-2 md:col-span-4"><div className="text-slate-500 text-xs uppercase">Deskripsi</div><div className="text-slate-700">{product.deskripsi || "-"}</div></div>
        </div>
      </Section>

      <Tabs defaultValue="recipe">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger data-testid="tab-recipe" value="recipe">Recipe ({recipe.length})</TabsTrigger>
          <TabsTrigger data-testid="tab-bundles" value="bundles">Bundle ({bundles.length})</TabsTrigger>
          <TabsTrigger data-testid="tab-pinmap" value="pinmap">Pin Map ({pinMap.length})</TabsTrigger>
          <TabsTrigger data-testid="tab-qc" value="qc">QC Template ({qcTpl.items?.length || 0})</TabsTrigger>
          <TabsTrigger data-testid="tab-mistakes" value="mistakes">Common Mistakes ({mistakes.length})</TabsTrigger>
          <TabsTrigger data-testid="tab-revisi" value="revisi">Revisi ({revisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="recipe">
          <Section title="Product Recipe — Daftar Kabel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urutan</TableHead>
                  <TableHead>Cable Code</TableHead>
                  <TableHead>Fungsi</TableHead>
                  <TableHead>Ukuran</TableHead>
                  <TableHead>Panjang</TableHead>
                  <TableHead className="text-right">Qty/pcs</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Skun A</TableHead>
                  <TableHead>Skun B</TableHead>
                  <TableHead>Solder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.map((c) => {
                  const fn = c.cable_function || {};
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="mono">{c.urutan}</TableCell>
                      <TableCell className="font-mono font-semibold">{c.cable_code}</TableCell>
                      <TableCell>{fn.nama_fungsi || "-"}</TableCell>
                      <TableCell className="mono">{fn.ukuran_kabel}</TableCell>
                      <TableCell className="mono">{fn.panjang_cm} cm</TableCell>
                      <TableCell className="text-right mono">{c.qty_per_pcs}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono">Bundle {c.bundle_code}</Badge></TableCell>
                      <TableCell className="text-xs">{c.skun_a || "-"}</TableCell>
                      <TableCell className="text-xs">{c.skun_b || "-"}</TableCell>
                      <TableCell>{c.perlu_solder ? "Ya" : "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bundles.map((b) => (
              <div key={b.bundle_code} data-testid={`bundle-card-${b.bundle_code}`} className="bg-white border border-slate-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 grid place-items-center bg-amber-100 text-amber-800 font-bold rounded-md">{b.bundle_code}</div>
                    <div>
                      <div className="font-semibold">{b.bundle_name}</div>
                      <div className="text-xs text-slate-500">{b.fungsi_bundle}</div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-600 leading-relaxed border-t pt-2 mt-2">{b.instruksi_singkat}</div>
                {b.target_relay_pin && (
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    <Plug className="w-3 h-3" /> Target: <span className="font-mono">{b.target_relay_pin}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pinmap">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pinMap.map((r) => (
              <div key={r.relay_number} className="bg-white border border-slate-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500">Relay {r.relay_number}</div>
                    <div className="font-semibold">{r.relay_name}</div>
                  </div>
                  <Badge variant="outline" className="font-mono">{r.relay_type}</Badge>
                </div>
                <Table>
                  <TableBody>
                    {r.pins.map((p) => (
                      <TableRow key={p.pin_number}>
                        <TableCell className="font-mono font-semibold w-12">{p.pin_number}</TableCell>
                        <TableCell className="font-mono text-xs">{p.cable_code || "-"}</TableCell>
                        <TableCell className="text-xs text-slate-600">{p.fungsi}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="qc">
          <Section title="QC Checklist Template">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Cara Tes</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(qcTpl.items || []).map((it, idx) => (
                  <TableRow key={it.id || idx}>
                    <TableCell className="mono">{it.urutan}</TableCell>
                    <TableCell className="font-medium">{it.nama}</TableCell>
                    <TableCell className="text-sm text-slate-600">{it.cara_tes}</TableCell>
                    <TableCell className="text-sm text-slate-600">{it.expected}</TableCell>
                    <TableCell>{it.required ? <Badge>Wajib</Badge> : <Badge variant="outline">Opsional</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="mistakes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mistakes.map((m) => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">{m.kesalahan}</div>
                    {m.bundle_code && <div className="text-xs text-slate-500 mt-0.5">Bundle {m.bundle_code}</div>}
                    <div className="text-sm text-slate-700 mt-2"><span className="font-semibold">Akibat:</span> {m.akibat}</div>
                    <div className="text-sm text-emerald-700 mt-1"><span className="font-semibold">Cara mencegah:</span> {m.cara_mencegah}</div>
                  </div>
                </div>
              </div>
            ))}
            {mistakes.length === 0 && <div className="text-slate-500 text-sm">Belum ada catatan.</div>}
          </div>
        </TabsContent>

        <TabsContent value="revisi">
          <Section title="Riwayat Revisi">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Diubah Oleh</TableHead>
                  <TableHead>Bagian</TableHead>
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisions.map((rv) => (
                  <TableRow key={rv.id}>
                    <TableCell>{fmtDate(rv.tanggal)}</TableCell>
                    <TableCell className="mono">{rv.versi}</TableCell>
                    <TableCell>{rv.diubah_oleh}</TableCell>
                    <TableCell>{rv.bagian_berubah}</TableCell>
                    <TableCell className="text-sm text-slate-600">{rv.alasan}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
