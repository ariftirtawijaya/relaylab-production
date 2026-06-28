import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Trash2, Eye, RefreshCw, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function fileUrl(file) {
  return file?.file_url || (file?.id ? `/api/files/${file.id}` : "");
}

function absoluteUrl(file) {
  const path = fileUrl(file);
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = process.env.REACT_APP_BACKEND_URL || "";
  return `${base}${path}`;
}

/**
 * Image gallery + uploader.
 *
 * Props:
 *  - relatedType: 'bundle' | 'work_instruction_step' | 'common_mistake' | 'qc_evidence'
 *  - relatedId: stable string id (e.g. bundle.id, "{wi}:{step}", mistake.id, "{wo}:{item}")
 *  - productSku?: string — stored for fast cleanup
 *  - canUpload?: bool (defaults to false) — show upload control
 *  - canEdit?:   bool (defaults to canUpload) — show delete/caption controls
 *  - title?: string — section label
 *  - compact?: bool — small layout (3-col grid, smaller thumbs)
 *  - emptyHint?: string — text when no photos
 *  - max?: int — soft cap (warning if exceeded)
 *  - onChange?: (files[]) => void
 *  - hideEmpty?: bool — render nothing when no files and !canUpload
 *  - testIdPrefix?: string — prefix for data-testid (default 'imgup')
 */
export default function ImageUploader({
  relatedType,
  relatedId,
  productSku,
  canUpload = false,
  canEdit,
  title,
  compact = false,
  emptyHint = "Belum ada foto.",
  max = 12,
  onChange,
  hideEmpty = false,
  testIdPrefix = "imgup",
}) {
  const allowDelete = canEdit ?? canUpload;
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // file
  const [renaming, setRenaming] = useState(null); // file being edited
  const [captionDraft, setCaptionDraft] = useState("");
  const inputRef = useRef(null);
  const replaceTargetRef = useRef(null);

  const load = useCallback(async () => {
    if (!relatedType || !relatedId) return;
    setLoading(true);
    try {
      const r = await api.get(`/files`, { params: { related_type: relatedType, related_id: relatedId } });
      setFiles(r.data || []);
      onChange?.(r.data || []);
    } catch (e) {
      // 401 not authenticated handled by axios interceptor; silent for others
    } finally {
      setLoading(false);
    }
  }, [relatedType, relatedId, onChange]);

  useEffect(() => { load(); }, [load]);

  const validate = (file) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error(`Format tidak didukung (${file.type || "unknown"}). Hanya JPG / PNG / WEBP.`);
      return false;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks 5 MB.`);
      return false;
    }
    return true;
  };

  const doUpload = async (file, replaceId = null) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("related_type", relatedType);
    fd.append("related_id", relatedId);
    if (productSku) fd.append("product_sku", productSku);
    try {
      setUploading(true);
      const r = await api.post(`/uploads`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (replaceId) {
        // soft-delete the old one
        try { await api.delete(`/files/${replaceId}`); } catch (e) { /* ignore */ }
      }
      toast.success("Foto berhasil diupload");
      setFiles((prev) => {
        const next = replaceId ? prev.filter((f) => f.id !== replaceId) : prev.slice();
        next.push(r.data);
        onChange?.(next);
        return next;
      });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!validate(f)) return;
    if (files.length >= max) {
      toast.error(`Maks ${max} foto`);
      return;
    }
    doUpload(f);
  };

  const onReplacePick = (e) => {
    const f = e.target.files?.[0];
    const target = replaceTargetRef.current;
    e.target.value = "";
    replaceTargetRef.current = null;
    if (!f || !target) return;
    if (!validate(f)) return;
    doUpload(f, target);
  };

  const onDelete = async (f) => {
    if (!window.confirm("Hapus foto ini?")) return;
    try {
      await api.delete(`/files/${f.id}`);
      setFiles((prev) => {
        const next = prev.filter((x) => x.id !== f.id);
        onChange?.(next);
        return next;
      });
      toast.success("Foto dihapus");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal hapus");
    }
  };

  const onSaveCaption = async () => {
    if (!renaming) return;
    try {
      await api.patch(`/files/${renaming.id}`, { caption: captionDraft });
      setFiles((prev) => prev.map((f) => f.id === renaming.id ? { ...f, caption: captionDraft } : f));
      toast.success("Caption disimpan");
      setRenaming(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal");
    }
  };

  if (hideEmpty && files.length === 0 && !canUpload) return null;

  const thumbCls = compact
    ? "w-full aspect-square object-cover rounded-md"
    : "w-full h-32 object-cover rounded-md";
  const gridCls = compact
    ? "grid grid-cols-3 sm:grid-cols-4 gap-2"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3";

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-root`}>
      {(title || canUpload) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {title && <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{title}</div>}
          {canUpload && (
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPick}
                className="hidden"
                data-testid={`${testIdPrefix}-input`}
              />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onReplacePick}
                className="hidden"
                data-testid={`${testIdPrefix}-replace-input`}
                id={`${testIdPrefix}-replace-${relatedId}`}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploading || files.length >= max}
                onClick={() => inputRef.current?.click()}
                data-testid={`${testIdPrefix}-upload-btn`}
                className="h-8"
              >
                {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ImagePlus className="w-3 h-3 mr-1" />}
                Upload Foto
              </Button>
            </div>
          )}
        </div>
      )}

      {files.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-2" data-testid={`${testIdPrefix}-empty`}>{emptyHint}</div>
      ) : (
        <div className={gridCls}>
          {files.map((f) => (
            <div key={f.id} className="relative group border border-slate-200 rounded-md overflow-hidden bg-slate-50" data-testid={`${testIdPrefix}-item-${f.id}`}>
              <button type="button" onClick={() => setLightbox(f)} className="block w-full" data-testid={`${testIdPrefix}-thumb-${f.id}`}>
                <img
                  src={absoluteUrl(f)}
                  alt={f.caption || f.original_filename}
                  className={thumbCls}
                  loading="lazy"
                />
              </button>
              {f.caption && (
                <div className="text-xs text-slate-700 px-2 py-1 truncate border-t bg-white" title={f.caption}>
                  {f.caption}
                </div>
              )}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  type="button"
                  onClick={() => setLightbox(f)}
                  className="bg-white/90 hover:bg-white border border-slate-300 rounded p-1"
                  title="Lihat"
                  data-testid={`${testIdPrefix}-view-${f.id}`}
                >
                  <Eye className="w-3 h-3" />
                </button>
                {allowDelete && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        replaceTargetRef.current = f.id;
                        document.getElementById(`${testIdPrefix}-replace-${relatedId}`)?.click();
                      }}
                      className="bg-white/90 hover:bg-white border border-slate-300 rounded p-1"
                      title="Ganti foto"
                      data-testid={`${testIdPrefix}-replace-${f.id}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRenaming(f); setCaptionDraft(f.caption || ""); }}
                      className="bg-white/90 hover:bg-white border border-slate-300 rounded p-1"
                      title="Caption"
                      data-testid={`${testIdPrefix}-caption-${f.id}`}
                    >
                      <span className="text-[10px] font-bold leading-none">Aa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(f)}
                      className="bg-white/90 hover:bg-red-100 border border-red-200 rounded p-1 text-red-600"
                      title="Hapus"
                      data-testid={`${testIdPrefix}-delete-${f.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{lightbox?.caption || lightbox?.original_filename}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <div className="space-y-2">
              <img src={absoluteUrl(lightbox)} alt={lightbox.caption || ""} className="w-full max-h-[70vh] object-contain bg-slate-100 rounded" />
              <div className="text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
                <span>{lightbox.original_filename} · {(lightbox.size / 1024).toFixed(0)} KB · {lightbox.mime_type}</span>
                <span>Upload: {lightbox.uploaded_by} · {new Date(lightbox.uploaded_at).toLocaleString("id-ID")}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLightbox(null)}><X className="w-4 h-4 mr-1" />Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Caption editor */}
      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Caption</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Caption</Label>
            <Input
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              placeholder="Contoh: Diode terpasang dengan katoda di kanan"
              data-testid={`${testIdPrefix}-caption-input`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Batal</Button>
            <Button onClick={onSaveCaption} className="bg-amber-600 hover:bg-amber-700" data-testid={`${testIdPrefix}-caption-save`}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Pure display gallery — no upload UI. Used in print and operator-only views. */
export function ImageGalleryReadOnly({ relatedType, relatedId, compact = true, emptyHide = true, testIdPrefix = "imggal" }) {
  return (
    <ImageUploader
      relatedType={relatedType}
      relatedId={relatedId}
      canUpload={false}
      canEdit={false}
      compact={compact}
      hideEmpty={emptyHide}
      testIdPrefix={testIdPrefix}
    />
  );
}
