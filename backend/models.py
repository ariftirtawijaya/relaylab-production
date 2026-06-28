"""Pydantic models for RelayLab Production System"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


# ---------- Users ----------
Role = Literal["Admin", "Production", "QC"]


class UserDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    username: str
    email: Optional[str] = None
    password_hash: str
    role: Role
    active: bool = True
    created_at: str = Field(default_factory=now_iso)


class UserOut(BaseModel):
    id: str
    name: str
    username: str
    email: Optional[str] = None
    role: Role
    active: bool


class LoginInput(BaseModel):
    username: str
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class UserCreateInput(BaseModel):
    name: str
    username: str
    email: Optional[str] = None
    password: str
    role: Role
    active: bool = True


class UserUpdateInput(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[Role] = None
    active: Optional[bool] = None


# ---------- Products ----------
ProductStatus = Literal["Draft", "Trial", "Released", "Hold", "Deprecated"]


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    sku: str
    nama_produk: str
    nama_pendek: Optional[str] = None
    kategori: Optional[str] = None
    versi: str = "V1"
    status: ProductStatus = "Draft"
    kapasitas_normal: int = 0
    deskripsi: Optional[str] = None
    konfigurasi: Optional[str] = None
    catatan_teknis: Optional[str] = None
    approved_by: Optional[str] = None
    # versioning relations
    parent_sku: Optional[str] = None  # immediate parent (clone source)
    source_sku: Optional[str] = None  # original (root) SKU; for traceability
    version_group: Optional[str] = None  # shared identifier for all versions; defaults to root sku
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class CloneProductInput(BaseModel):
    new_sku: str
    new_nama_produk: str
    new_versi: str = "V2"
    new_status: Literal["Draft", "Trial"] = "Draft"
    catatan: Optional[str] = None
    copy_recipe: bool = True
    copy_bundles: bool = True
    copy_work_instructions: bool = True
    copy_pin_map: bool = True
    copy_qc_template: bool = True
    copy_common_mistakes: bool = True
    copy_photos: bool = True
    hold_old: bool = False


# ---------- Cable Functions ----------
CableCategory = Literal["Power", "Ground", "Trigger", "Output", "Jumper", "Input"]


class CableFunction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    cable_code: str
    nama_fungsi: str
    deskripsi: Optional[str] = None
    ukuran_kabel: str  # e.g. "0.5mm"
    panjang_cm: float
    warna_default: Optional[str] = None
    kategori: CableCategory
    warna_wajib: bool = False
    catatan_substitusi: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ---------- Machine Program ----------
class MachineProgram(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    nomor_program: str  # P01
    ukuran_kabel: str
    panjang_cm: float
    strip_depan_mm: float = 0
    strip_belakang_mm: float = 0
    knife_setting: Optional[str] = None
    retreat_setting: Optional[str] = None
    catatan: Optional[str] = None
    cable_codes: List[str] = Field(default_factory=list)


# ---------- Product Recipe (Cable line items) ----------
class ProductCable(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    cable_code: str
    qty_per_pcs: int = 1
    bundle_code: str
    urutan: int = 0
    skun_a: Optional[str] = None
    skun_b: Optional[str] = None
    perlu_solder: bool = False
    catatan_proses: Optional[str] = None


# ---------- Product Bundle ----------
class ProductBundle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    bundle_code: str
    bundle_name: str
    fungsi_bundle: Optional[str] = None
    instruksi_singkat: Optional[str] = None
    target_relay_pin: Optional[str] = None
    urutan: int = 0
    foto_url: Optional[str] = None


# ---------- Work Instruction ----------
class WorkInstructionStep(BaseModel):
    step_number: int
    instruksi: str
    komponen: Optional[str] = None
    tools: Optional[str] = None
    safety: Optional[str] = None
    foto_url: Optional[str] = None
    common_mistake: Optional[str] = None


class WorkInstruction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    bundle_code: str
    steps: List[WorkInstructionStep] = Field(default_factory=list)


# ---------- Relay Pin Map ----------
class RelayPin(BaseModel):
    pin_number: str  # "30", "85", "86", "87", "87a"
    cable_code: Optional[str] = None
    fungsi: Optional[str] = None
    catatan: Optional[str] = None


class RelayPinMap(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    relay_number: int
    relay_name: str
    relay_type: Literal["4 pin", "5 pin"] = "4 pin"
    pins: List[RelayPin] = Field(default_factory=list)
    catatan: Optional[str] = None


# ---------- QC Checklist Template ----------
class QcChecklistItem(BaseModel):
    id: str = Field(default_factory=gen_id)
    nama: str
    cara_tes: Optional[str] = None
    expected: Optional[str] = None
    required: bool = True
    urutan: int = 0


class QcChecklistTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    items: List[QcChecklistItem] = Field(default_factory=list)


# ---------- Common Mistakes ----------
class CommonMistake(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    bundle_code: Optional[str] = None
    kesalahan: str
    akibat: Optional[str] = None
    cara_mencegah: Optional[str] = None
    foto_url: Optional[str] = None


# ---------- Revision History ----------
class RevisionHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    product_sku: str
    versi: str
    tanggal: str = Field(default_factory=now_iso)
    diubah_oleh: str
    bagian_berubah: str
    alasan: Optional[str] = None
    catatan_approval: Optional[str] = None


# ---------- Work Order ----------
WoStatus = Literal[
    "Draft",
    "Menunggu Cutting",
    "Cutting Berjalan",
    "Cutting Selesai",
    "Produksi Berjalan",
    "Menunggu QC",
    "QC Berjalan",
    "QC Pass",
    "Rework",
    "Packing",
    "Done",
    "Cancelled",
]


class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    wo_number: str
    tanggal: str = Field(default_factory=now_iso)
    reseller: Optional[str] = None
    product_sku: str
    qty: int
    deadline: Optional[str] = None
    prioritas: Literal["Normal", "Urgent"] = "Normal"
    status: WoStatus = "Draft"
    catatan: Optional[str] = None
    operator_cutting: Optional[str] = None
    operator_produksi: Optional[str] = None
    qc_person: Optional[str] = None
    created_by: Optional[str] = None
    briefing: Optional[dict] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class WorkOrderCreateInput(BaseModel):
    reseller: Optional[str] = None
    product_sku: str
    qty: int
    deadline: Optional[str] = None
    prioritas: Literal["Normal", "Urgent"] = "Normal"
    catatan: Optional[str] = None


class WorkOrderUpdateInput(BaseModel):
    reseller: Optional[str] = None
    qty: Optional[int] = None
    deadline: Optional[str] = None
    prioritas: Optional[Literal["Normal", "Urgent"]] = None
    status: Optional[WoStatus] = None
    catatan: Optional[str] = None
    operator_cutting: Optional[str] = None
    operator_produksi: Optional[str] = None
    qc_person: Optional[str] = None


# ---------- Batch Color ----------
class BatchColor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    wo_number: str
    cable_code: str
    warna_default: Optional[str] = None
    warna_aktual: str
    alasan: Optional[str] = None
    input_by: Optional[str] = None
    timestamp: str = Field(default_factory=now_iso)


class BatchColorInput(BaseModel):
    cable_code: str
    warna_aktual: str
    alasan: Optional[str] = None


# ---------- QC Result ----------
class QcResultItem(BaseModel):
    item_id: str
    nama: str
    required: bool
    pass_fail: Literal["Pass", "Fail", "NA"] = "NA"
    catatan: Optional[str] = None
    foto_url: Optional[str] = None


class QcResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    wo_number: str
    product_sku: str
    qc_person: Optional[str] = None
    items: List[QcResultItem] = Field(default_factory=list)
    overall: Literal["Pass", "Fail", "Pending"] = "Pending"
    catatan_rework: Optional[str] = None
    timestamp: str = Field(default_factory=now_iso)


class QcResultInput(BaseModel):
    items: List[QcResultItem]
    catatan_rework: Optional[str] = None


# ---------- Training Matrix ----------
SkillLevel = Literal[
    "Belum training",
    "Training",
    "Bisa dengan pengawasan",
    "Bisa mandiri",
    "Trainer",
]


class TrainingMatrix(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    nama_karyawan: str
    product_sku: str
    skill_level: SkillLevel = "Belum training"
    tanggal_training: Optional[str] = None
    approved_by: Optional[str] = None
    catatan: Optional[str] = None


# ---------- File Asset (Reference Photos for Phase P3A) ----------
RelatedType = Literal[
    "bundle",                 # related_id = bundle id
    "work_instruction_step",  # related_id = "{wi_id}:{step_number}"
    "common_mistake",         # related_id = common_mistake id
    "qc_evidence",            # related_id = "{wo_number}:{qc_item_id}"
]


class FileAsset(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    storage_path: str
    file_url: str            # `/api/files/{id}` — what frontend uses for <img src>
    original_filename: str
    mime_type: str
    size: int
    related_type: RelatedType
    related_id: str
    product_sku: Optional[str] = None  # for fast cleanup on clone/delete
    caption: Optional[str] = None
    notes: Optional[str] = None
    source_file_id: Optional[str] = None  # set when this asset was created via Clone Photo
    uploaded_by: str
    uploaded_at: str = Field(default_factory=now_iso)
    is_deleted: bool = False

