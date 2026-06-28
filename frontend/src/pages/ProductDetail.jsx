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
import { ArrowLeft, CheckCircle2, AlertTriangle, Plug, Pencil, GitCompareArrows } from "lucide-react";
import { fmtDate } from "@/lib/utils-app";
import { toast } from "sonner";
import RecipeEditor from "@/components/editors/RecipeEditor";
import BundleEditor from "@/components/editors/BundleEditor";
import PinMapEditor from "@/components/editors/PinMapEditor";
import QcTemplateEditor from "@/components/editors/QcTemplateEditor";
import CloneProductDialog from "@/components/CloneProductDialog";
import { ImageGalleryReadOnly } from "@/components/ImageUploader";
import { GitBranch } from "lucide-react";

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
  const [editMode, setEditMode] = useState(null); // 'recipe' | 'bundles' | 'pinmap' | 'qc' | null
  const [cloneOpen, setCloneOpen] = useState(false);

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
          <div className="flex gap-2 flex-wrap">
            <Link to="/products"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Kembali</Button></Link>
            {(product.parent_sku || product.source_sku) && (
              <Link to={`/products/${product.sku}/compare/${product.parent_sku || product.source_sku}`}>
                <Button data-testid="compare-product-btn" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  <GitCompareArrows className="w-4 h-4 mr-2" />Bandingkan dengan Produk Asal
                </Button>
              </Link>
            )}
            {hasRole(user, "Admin") && (
              <Button data-testid="clone-product-btn" onClick={() => setCloneOpen(true)} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <GitBranch className="w-4 h-4 mr-2" />Buat Versi Baru
              </Button>
            )}
            {hasRole(user, "Admin") && product.status !== "Released" && (
              <Button data-testid="approve-product" onClick={approve} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="w-4 h-4 mr-2" />Approve Released</Button>
            )}
          </div>
        }
      />

      <CloneProductDialog product={product} open={cloneOpen} setOpen={setCloneOpen} />

      <Section className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-slate-500 text-xs uppercase">Versi</div><div className="font-mono">{product.versi}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Kategori</div><div>{product.kategori || "-"}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Kapasitas / hari</div><div className="font-mono">{product.kapasitas_normal} pcs</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Approved by</div><div>{product.approved_by || "-"}</div></div>
          {(product.parent_sku || product.source_sku || product.version_group) && (
            <div className="col-span-2 md:col-span-4 border-t pt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              {product.parent_sku && (
                <div>
                  <span className="text-slate-500 uppercase">Parent SKU: </span>
                  <Link to={`/products/${product.parent_sku}`} className="font-mono text-amber-700 hover:underline" data-testid="product-parent-link">{product.parent_sku}</Link>
                </div>
              )}
              {product.source_sku && product.source_sku !== product.parent_sku && (
                <div><span className="text-slate-500 uppercase">Original SKU: </span><Link to={`/products/${product.source_sku}`} className="font-mono text-amber-700 hover:underline">{product.source_sku}</Link></div>
              )}
              {product.version_group && (
                <div><span className="text-slate-500 uppercase">Version Group: </span><span className="font-mono">{product.version_group}</span></div>
              )}
            </div>
          )}
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
          {editMode === "recipe" ? (
            <Section title="Edit Recipe">
              <RecipeEditor product={product} onClose={() => setEditMode(null)} onSaved={load} />
            </Section>
          ) : (
            <Section
              title="Product Recipe — Daftar Kabel"
              action={hasRole(user, "Admin") && <Button size="sm" variant="outline" onClick={() => setEditMode("recipe")} data-testid="edit-recipe"><Pencil className="w-3 h-3 mr-1" />Ubah</Button>}
            >
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
                    <TableRow key={c.id} data-testid={`cable-row-${c.cable_code}`}>
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
          )}
        </TabsContent>

        <TabsContent value="bundles">
          {editMode === "bundles" ? (
            <Section title="Edit Bundle">
              <BundleEditor product={product} onClose={() => setEditMode(null)} onSaved={load} />
            </Section>
          ) : (
            <>
            <div className="flex justify-end mb-2">
              {hasRole(user, "Admin") && <Button size="sm" variant="outline" onClick={() => setEditMode("bundles")} data-testid="edit-bundles"><Pencil className="w-3 h-3 mr-1" />Ubah Bundle & Instruction</Button>}
            </div>
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
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <ImageGalleryReadOnly
                    relatedType="bundle"
                    relatedId={b.id}
                    compact={true}
                    emptyHide={true}
                    testIdPrefix={`product-bundle-photo-${b.bundle_code}`}
                  />
                </div>
              </div>
            ))}
          </div>
          </>
          )}
        </TabsContent>

        <TabsContent value="pinmap">
          {editMode === "pinmap" ? (
            <Section title="Edit Pin Map">
              <PinMapEditor product={product} onClose={() => setEditMode(null)} onSaved={load} />
            </Section>
          ) : (
            <>
            <div className="flex justify-end mb-2">
              {hasRole(user, "Admin") && <Button size="sm" variant="outline" onClick={() => setEditMode("pinmap")} data-testid="edit-pinmap"><Pencil className="w-3 h-3 mr-1" />Ubah Pin Map</Button>}
            </div>
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
          </>
          )}
        </TabsContent>

        <TabsContent value="qc">
          {editMode === "qc" ? (
            <Section title="Edit QC Template">
              <QcTemplateEditor product={product} onClose={() => setEditMode(null)} onSaved={load} />
            </Section>
          ) : (
          <Section
            title="QC Checklist Template"
            action={hasRole(user, "Admin") && <Button size="sm" variant="outline" onClick={() => setEditMode("qc")} data-testid="edit-qc"><Pencil className="w-3 h-3 mr-1" />Ubah</Button>}
          >
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
          )}
        </TabsContent>

        <TabsContent value="mistakes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mistakes.map((m) => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-md p-4" data-testid={`mistake-card-${m.id}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{m.kesalahan}</div>
                    {m.bundle_code && <div className="text-xs text-slate-500 mt-0.5">Bundle {m.bundle_code}</div>}
                    <div className="text-sm text-slate-700 mt-2"><span className="font-semibold">Akibat:</span> {m.akibat}</div>
                    <div className="text-sm text-emerald-700 mt-1"><span className="font-semibold">Cara mencegah:</span> {m.cara_mencegah}</div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <ImageGalleryReadOnly
                        relatedType="common_mistake"
                        relatedId={m.id}
                        compact={true}
                        emptyHide={!hasRole(user, "Admin")}
                        testIdPrefix={`mistake-photo-${m.id}`}
                      />
                      {hasRole(user, "Admin") && (
                        <details className="mt-2">
                          <summary className="text-xs text-amber-700 cursor-pointer hover:underline" data-testid={`mistake-manage-${m.id}`}>Kelola Foto</summary>
                          <div className="mt-2">
                            <AdminMistakeUploader sku={sku} mistakeId={m.id} />
                          </div>
                        </details>
                      )}
                    </div>
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

import ImageUploader from "@/components/ImageUploader";

function AdminMistakeUploader({ sku, mistakeId }) {
  return (
    <ImageUploader
      relatedType="common_mistake"
      relatedId={mistakeId}
      productSku={sku}
      canUpload={true}
      title="Upload / Hapus Foto"
      compact={true}
      emptyHint="Belum ada foto contoh kesalahan."
      max={4}
      testIdPrefix={`mistake-admin-${mistakeId}`}
    />
  );
}

