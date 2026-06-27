"""Seed data for RelayLab Production OS - Foglamp AOD product."""
from auth import hash_password
from models import (
    UserDoc, Product, CableFunction, MachineProgram,
    ProductCable, ProductBundle, WorkInstruction, WorkInstructionStep,
    RelayPinMap, RelayPin, QcChecklistTemplate, QcChecklistItem,
    CommonMistake, RevisionHistory, TrainingMatrix,
)


SKU = "RFL-AOD-H11-V1"


def seed_users():
    return [
        UserDoc(
            name="Arif", username="arif", email="arif@relaylab.local",
            password_hash=hash_password("admin123"), role="Admin",
        ),
        UserDoc(
            name="Redi", username="redi", email="redi@relaylab.local",
            password_hash=hash_password("prod123"), role="Production",
        ),
        UserDoc(
            name="Leni", username="leni", email="leni@relaylab.local",
            password_hash=hash_password("qc123"), role="QC",
        ),
        UserDoc(
            name="Windu", username="windu", email="windu@relaylab.local",
            password_hash=hash_password("prod123"), role="Production",
        ),
        UserDoc(
            name="Dede", username="dede", email="dede@relaylab.local",
            password_hash=hash_password("prod123"), role="Production",
        ),
        UserDoc(
            name="Fauzi", username="fauzi", email="fauzi@relaylab.local",
            password_hash=hash_password("prod123"), role="Production",
        ),
    ]


def seed_products():
    return [
        Product(
            sku=SKU,
            nama_produk="Relay Set Biled Foglamp Auto Off Devil",
            nama_pendek="Foglamp AOD",
            kategori="Relay Foglamp",
            versi="V1",
            status="Released",
            kapasitas_normal=100,
            konfigurasi="1 fuse + 2 relay 4 kaki + 1 relay 5 kaki",
            deskripsi="Relay set biled foglamp dengan fitur auto off devil eye. Output low beam, high beam, dan devil eye.",
            approved_by="Arif",
        ),
    ]


def seed_cable_functions():
    data = [
        ("DEV-OUT-S", "Output devil pendek", "0.5mm", 86, "Abu-abu", "Output", False),
        ("DEV-OUT-L", "Output devil panjang", "0.5mm", 186, "Abu-abu", "Output", False),
        ("HIGH-OUT-S", "Output high beam pendek", "0.85mm", 83, "Biru", "Output", False),
        ("HIGH-OUT-L", "Output high beam panjang", "0.85mm", 183, "Biru", "Output", False),
        ("LOW-OUT-S", "Output low beam pendek", "1.5mm", 80, "Putih", "Output", False),
        ("LOW-OUT-L", "Output low beam panjang", "1.5mm", 180, "Putih", "Output", False),
        ("TRG-LOW-POS", "Trigger low positif", "0.5mm", 60, "Merah", "Trigger", False),
        ("TRG-LOW-GND", "Trigger low ground", "0.5mm", 60, "Hitam", "Trigger", False),
        ("TRG-LOW-JMP-POS", "Jumper trigger low ke relay AOD (positif)", "0.5mm", 10, "Merah", "Jumper", False),
        ("TRG-LOW-JMP-GND", "Jumper trigger low ke relay AOD (ground)", "0.5mm", 8, "Hitam", "Jumper", False),
        ("TRG-HIGH-A", "Trigger high A", "0.5mm", 60, "Putih", "Trigger", False),
        ("TRG-HIGH-B", "Trigger high B", "0.5mm", 60, "Kuning", "Trigger", False),
        ("SENJA-IN", "Input senja/devil", "0.85mm", 60, "Ungu", "Input", False),
        ("BATT-IN", "Input aki ke fuse", "2mm", 60, "Merah", "Power", True),
        ("FUSE-JMP-A", "Jumper fuse ke relay", "2mm", 6.5, "Merah", "Jumper", True),
        ("FUSE-JMP-B", "Jumper antar relay power", "2mm", 7, "Merah", "Jumper", True),
        ("GND-OUT", "Ground output", "2mm", 50, "Hitam", "Ground", True),
    ]
    return [
        CableFunction(
            cable_code=c, nama_fungsi=n, ukuran_kabel=u, panjang_cm=p,
            warna_default=w, kategori=k, warna_wajib=req,
        )
        for c, n, u, p, w, k, req in data
    ]


def seed_machine_programs():
    data = [
        ("P01", "0.5mm", 86, ["DEV-OUT-S"]),
        ("P02", "0.5mm", 186, ["DEV-OUT-L"]),
        ("P03", "0.85mm", 83, ["HIGH-OUT-S"]),
        ("P04", "0.85mm", 183, ["HIGH-OUT-L"]),
        ("P05", "1.5mm", 80, ["LOW-OUT-S"]),
        ("P06", "1.5mm", 180, ["LOW-OUT-L"]),
        ("P07", "0.5mm", 60, ["TRG-LOW-POS", "TRG-LOW-GND", "TRG-HIGH-A", "TRG-HIGH-B"]),
        ("P08", "0.5mm", 10, ["TRG-LOW-JMP-POS"]),
        ("P09", "0.5mm", 8, ["TRG-LOW-JMP-GND"]),
        ("P10", "0.85mm", 60, ["SENJA-IN"]),
        ("P11", "2mm", 60, ["BATT-IN"]),
        ("P12", "2mm", 6.5, ["FUSE-JMP-A"]),
        ("P13", "2mm", 7, ["FUSE-JMP-B"]),
        ("P14", "2mm", 50, ["GND-OUT"]),
    ]
    return [
        MachineProgram(
            nomor_program=n, ukuran_kabel=u, panjang_cm=p,
            strip_depan_mm=5, strip_belakang_mm=5, cable_codes=cc,
            catatan="Setting default, kalibrasi ulang di mesin SWT508C.",
        )
        for n, u, p, cc in data
    ]


def seed_product_cables():
    # (cable_code, qty_per_pcs, bundle_code, urutan, skun_a, skun_b, solder, catatan)
    rows = [
        ("DEV-OUT-S", 1, "A", 1, "Skun relay", "Skun 6.8mm", False, "Gabung ujung dengan DEV-OUT-L, crimp skun relay."),
        ("DEV-OUT-L", 1, "A", 2, "Skun relay", "Skun 6.8mm", False, ""),
        ("HIGH-OUT-S", 1, "B", 1, "Skun relay", "Skun 6.8mm", False, "Gabung ujung dengan HIGH-OUT-L."),
        ("HIGH-OUT-L", 1, "B", 2, "Skun relay", "Skun 6.8mm", False, ""),
        ("LOW-OUT-S", 1, "C", 1, "Skun relay", "Skun H11 female", True, "Solder titik gabungan."),
        ("LOW-OUT-L", 1, "C", 2, "Skun relay", "Skun H11 female", True, ""),
        ("TRG-LOW-POS", 1, "D", 1, "Skun relay (gabung diode)", "Skun H11 male", True, "Gabung dengan katoda diode + TRG-LOW-JMP-POS."),
        ("TRG-LOW-JMP-POS", 1, "D", 2, "Skun relay (gabung diode)", "Skun relay", True, ""),
        ("TRG-LOW-GND", 1, "E", 1, "Skun relay", "Skun H11 male", False, "Gabung ujung dengan TRG-LOW-JMP-GND."),
        ("TRG-LOW-JMP-GND", 1, "E", 2, "Skun relay", "Skun relay", False, ""),
        ("TRG-HIGH-A", 1, "I", 1, "Skun relay", "Tanpa skun", False, "Ujung tanpa skun untuk soket H4."),
        ("TRG-HIGH-B", 1, "I", 2, "Skun relay", "Tanpa skun", False, ""),
        ("SENJA-IN", 1, "J", 1, "Skun relay", "Tanpa skun", False, "Ujung tanpa skun untuk input senja."),
        ("BATT-IN", 1, "F", 1, "Skun sikring", "Skun bulat aki M6", False, ""),
        ("FUSE-JMP-A", 1, "G", 1, "Skun sikring", "Skun relay", False, "Gabung dengan FUSE-JMP-B."),
        ("FUSE-JMP-B", 1, "G", 2, "Skun relay", "Skun relay", False, ""),
        ("GND-OUT", 2, "H", 1, "Skun bulat aki M6", "Skun H11 female", False, "Dua kabel: kiri dan kanan."),
    ]
    return [
        ProductCable(
            product_sku=SKU, cable_code=c, qty_per_pcs=q, bundle_code=b, urutan=u,
            skun_a=sa, skun_b=sb, perlu_solder=sol, catatan_proses=cat,
        )
        for c, q, b, u, sa, sb, sol, cat in rows
    ]


def seed_product_bundles():
    rows = [
        ("A", "Devil Output", "Output devil eye kiri-kanan", "Gabungkan salah satu ujung kedua kabel, crimp ke skun relay. Ujung cabang masing-masing crimp skun 6.8mm.", "Relay 3 pin 87a"),
        ("B", "High Beam Output", "Output high beam kiri-kanan", "Gabungkan ujung kedua kabel, crimp ke skun relay. Ujung cabang masing-masing crimp skun 6.8mm.", "Relay 2 pin 87"),
        ("C", "Low Beam Output", "Output low beam kiri-kanan", "Gabungkan ujung kedua kabel, crimp ke skun relay dan solder. Ujung cabang masing-masing crimp skun H11 female.", "Relay 1 pin 87"),
        ("D", "Trigger Low + Diode", "Trigger low positif dengan diode 3A", "Gabungkan katoda diode 3A dengan ujung TRG-LOW-POS dan TRG-LOW-JMP-POS, crimp ke skun relay dan solder. Anoda diode disolder ke kabel HIGH-OUT.", "Relay 1 pin 86, Relay 3 pin 86"),
        ("E", "Ground Trigger Low/AOD", "Ground trigger low dan AOD", "Gabungkan salah satu ujung kedua kabel, crimp ke skun relay.", "Relay 1 pin 85, Relay 3 pin 85"),
        ("F", "Input Aki", "Input dari aki ke fuse", "Satu ujung crimp skun sikring, ujung lain crimp skun bulat aki M6.", "Soket sikring"),
        ("G", "Fuse to Relay", "Jumper fuse ke pin 30 Relay 1 & 2", "Ujung FUSE-JMP-A crimp skun sikring. Ujung lain digabung FUSE-JMP-B lalu crimp skun relay. Ujung lain FUSE-JMP-B crimp skun relay.", "Relay 1 pin 30, Relay 2 pin 30"),
        ("H", "Ground Output", "Ground output lampu kiri & kanan", "Masing-masing kabel: satu ujung crimp skun bulat aki M6, ujung lain crimp skun H11 female.", "Ground M6"),
        ("I", "Trigger High Beam", "Trigger high beam dari soket H4", "Salah satu ujung masing-masing kabel crimp skun relay, ujung lain dibiarkan tanpa skun.", "Relay 2 pin 86 & 85"),
        ("J", "Input Senja", "Input senja/devil ke Relay AOD", "Salah satu ujung crimp skun relay, ujung lain dibiarkan tanpa skun.", "Relay 3 pin 30"),
    ]
    return [
        ProductBundle(
            product_sku=SKU, bundle_code=code, bundle_name=name,
            fungsi_bundle=fungsi, instruksi_singkat=ins, target_relay_pin=target,
            urutan=i + 1,
        )
        for i, (code, name, fungsi, ins, target) in enumerate(rows)
    ]


def seed_work_instructions():
    out = []
    # Bundle A
    out.append(WorkInstruction(product_sku=SKU, bundle_code="A", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil DEV-OUT-S 0.5mm 86cm.", komponen="DEV-OUT-S"),
        WorkInstructionStep(step_number=2, instruksi="Ambil DEV-OUT-L 0.5mm 186cm.", komponen="DEV-OUT-L"),
        WorkInstructionStep(step_number=3, instruksi="Gabungkan salah satu ujung kedua kabel, lalu crimp ke skun relay.", tools="Crimping tool, skun relay"),
        WorkInstructionStep(step_number=4, instruksi="Ujung yang lain dari masing-masing kabel dicrimp dengan skun 6.8mm.", tools="Crimping tool, skun 6.8mm"),
        WorkInstructionStep(step_number=5, instruksi="Cek kekuatan crimping dengan tarik ringan.", common_mistake="Crimp lepas saat ditarik = perlu re-crimp."),
    ]))
    # Bundle B
    out.append(WorkInstruction(product_sku=SKU, bundle_code="B", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil HIGH-OUT-S 0.85mm 83cm dan HIGH-OUT-L 0.85mm 183cm.", komponen="HIGH-OUT-S, HIGH-OUT-L"),
        WorkInstructionStep(step_number=2, instruksi="Gabungkan ujung kedua kabel, crimp ke skun relay.", tools="Crimping tool"),
        WorkInstructionStep(step_number=3, instruksi="Crimp ujung cabang masing-masing dengan skun 6.8mm.", tools="Skun 6.8mm"),
    ]))
    # Bundle C
    out.append(WorkInstruction(product_sku=SKU, bundle_code="C", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil LOW-OUT-S 1.5mm 80cm dan LOW-OUT-L 1.5mm 180cm.", komponen="LOW-OUT-S, LOW-OUT-L"),
        WorkInstructionStep(step_number=2, instruksi="Gabungkan ujung kedua kabel, crimp ke skun relay.", tools="Crimping tool"),
        WorkInstructionStep(step_number=3, instruksi="Solder titik crimp agar kuat dan tidak lepas.", tools="Solder, timah", safety="Hati-hati panas solder."),
        WorkInstructionStep(step_number=4, instruksi="Crimp ujung cabang masing-masing dengan skun H11 female.", tools="Skun H11 female"),
    ]))
    # Bundle D
    out.append(WorkInstruction(product_sku=SKU, bundle_code="D", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil TRG-LOW-POS 0.5mm 60cm.", komponen="TRG-LOW-POS"),
        WorkInstructionStep(step_number=2, instruksi="Ambil TRG-LOW-JMP-POS 0.5mm 10cm.", komponen="TRG-LOW-JMP-POS"),
        WorkInstructionStep(step_number=3, instruksi="Ambil diode 3A.", komponen="Diode 3A"),
        WorkInstructionStep(step_number=4, instruksi="Pastikan arah diode benar. Katoda adalah sisi yang ada tanda garis.", common_mistake="Diode terbalik = low beam tidak ikut saat high beam aktif."),
        WorkInstructionStep(step_number=5, instruksi="Gabungkan katoda diode dengan ujung TRG-LOW-POS dan TRG-LOW-JMP-POS."),
        WorkInstructionStep(step_number=6, instruksi="Crimp ketiganya ke skun relay.", tools="Crimping tool, skun relay"),
        WorkInstructionStep(step_number=7, instruksi="Solder titik crimp tersebut agar kuat.", tools="Solder, timah"),
        WorkInstructionStep(step_number=8, instruksi="Ujung lain TRG-LOW-JMP-POS crimp skun relay."),
        WorkInstructionStep(step_number=9, instruksi="Ujung lain TRG-LOW-POS crimp skun H11 male."),
        WorkInstructionStep(step_number=10, instruksi="Anoda diode disolder ke kabel HIGH-OUT (saat assembly akhir)."),
        WorkInstructionStep(step_number=11, instruksi="Cek ulang arah diode sebelum assembly.", safety="Salah arah diode = produk reject."),
    ]))
    # Bundle E
    out.append(WorkInstruction(product_sku=SKU, bundle_code="E", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil TRG-LOW-GND 0.5mm 60cm dan TRG-LOW-JMP-GND 0.5mm 8cm.", komponen="TRG-LOW-GND, TRG-LOW-JMP-GND"),
        WorkInstructionStep(step_number=2, instruksi="Gabungkan salah satu ujung kedua kabel, crimp ke skun relay."),
        WorkInstructionStep(step_number=3, instruksi="Ujung lain TRG-LOW-GND crimp skun H11 male."),
        WorkInstructionStep(step_number=4, instruksi="Ujung lain TRG-LOW-JMP-GND crimp skun relay."),
    ]))
    # Bundle F
    out.append(WorkInstruction(product_sku=SKU, bundle_code="F", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil BATT-IN 2mm 60cm warna merah.", komponen="BATT-IN"),
        WorkInstructionStep(step_number=2, instruksi="Satu ujung crimp skun sikring.", tools="Skun sikring"),
        WorkInstructionStep(step_number=3, instruksi="Ujung lain crimp skun bulat aki M6.", tools="Skun bulat M6"),
    ]))
    # Bundle G
    out.append(WorkInstruction(product_sku=SKU, bundle_code="G", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil FUSE-JMP-A 2mm 6.5cm dan FUSE-JMP-B 2mm 7cm.", komponen="FUSE-JMP-A, FUSE-JMP-B"),
        WorkInstructionStep(step_number=2, instruksi="Salah satu ujung FUSE-JMP-A crimp skun sikring."),
        WorkInstructionStep(step_number=3, instruksi="Ujung lain FUSE-JMP-A digabung dengan FUSE-JMP-B, crimp skun relay."),
        WorkInstructionStep(step_number=4, instruksi="Ujung lain FUSE-JMP-B crimp skun relay."),
    ]))
    # Bundle H
    out.append(WorkInstruction(product_sku=SKU, bundle_code="H", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil 2 buah GND-OUT 2mm 50cm warna hitam.", komponen="GND-OUT x2"),
        WorkInstructionStep(step_number=2, instruksi="Tiap kabel: satu ujung crimp skun bulat aki M6, ujung lain crimp skun H11 female."),
    ]))
    # Bundle I
    out.append(WorkInstruction(product_sku=SKU, bundle_code="I", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil TRG-HIGH-A dan TRG-HIGH-B 0.5mm 60cm.", komponen="TRG-HIGH-A, TRG-HIGH-B"),
        WorkInstructionStep(step_number=2, instruksi="Crimp salah satu ujung masing-masing kabel ke skun relay."),
        WorkInstructionStep(step_number=3, instruksi="Ujung lain dibiarkan tanpa skun (akan disambung ke soket H4)."),
    ]))
    # Bundle J
    out.append(WorkInstruction(product_sku=SKU, bundle_code="J", steps=[
        WorkInstructionStep(step_number=1, instruksi="Ambil SENJA-IN 0.85mm 60cm.", komponen="SENJA-IN"),
        WorkInstructionStep(step_number=2, instruksi="Crimp salah satu ujung ke skun relay."),
        WorkInstructionStep(step_number=3, instruksi="Ujung lain dibiarkan tanpa skun (untuk input senja)."),
    ]))
    return out


def seed_pin_maps():
    return [
        RelayPinMap(
            product_sku=SKU, relay_number=1, relay_name="Low Beam Relay", relay_type="4 pin",
            pins=[
                RelayPin(pin_number="30", cable_code="FUSE-JMP-B", fungsi="Input arus dari fuse"),
                RelayPin(pin_number="85", cable_code="TRG-LOW-GND", fungsi="Ground trigger low"),
                RelayPin(pin_number="86", cable_code="TRG-LOW-POS", fungsi="Positif trigger low"),
                RelayPin(pin_number="87", cable_code="LOW-OUT-S/L", fungsi="Output low beam ke soket H11"),
            ],
        ),
        RelayPinMap(
            product_sku=SKU, relay_number=2, relay_name="High Beam Relay", relay_type="4 pin",
            pins=[
                RelayPin(pin_number="30", cable_code="FUSE-JMP-A", fungsi="Input arus dari fuse"),
                RelayPin(pin_number="85", cable_code="TRG-HIGH-B", fungsi="Trigger high (ground)"),
                RelayPin(pin_number="86", cable_code="TRG-HIGH-A", fungsi="Trigger high (positif)"),
                RelayPin(pin_number="87", cable_code="HIGH-OUT-S/L", fungsi="Output high beam"),
            ],
        ),
        RelayPinMap(
            product_sku=SKU, relay_number=3, relay_name="AOD Relay", relay_type="5 pin",
            pins=[
                RelayPin(pin_number="30", cable_code="SENJA-IN", fungsi="Input senja/devil"),
                RelayPin(pin_number="85", cable_code="TRG-LOW-JMP-GND", fungsi="Ground trigger AOD"),
                RelayPin(pin_number="86", cable_code="TRG-LOW-JMP-POS", fungsi="Positif trigger AOD"),
                RelayPin(pin_number="87a", cable_code="DEV-OUT-S/L", fungsi="Output devil eye (NC)"),
                RelayPin(pin_number="87", fungsi="Tidak digunakan"),
            ],
        ),
    ]


def seed_qc_template():
    items = [
        ("Visual crimping", "Tarik ringan setiap sambungan.", "Tidak lepas.", True),
        ("Visual solder diode", "Cek titik solder diode dan sambungan penting.", "Solder matang, tidak cold solder.", True),
        ("Fuse input", "Cek jalur dari aki ke fuse.", "Tersambung normal, tidak short.", True),
        ("Low beam output", "Aktifkan trigger low.", "Output low kiri dan kanan aktif.", True),
        ("High beam output", "Aktifkan trigger high.", "Output high kiri dan kanan aktif.", True),
        ("Bypass diode", "Aktifkan trigger high.", "Low ikut aktif sesuai desain.", True),
        ("Devil eye", "Aktifkan input senja.", "Output devil aktif.", True),
        ("Auto off devil", "Aktifkan low beam.", "Devil eye mati.", True),
        ("Ground output", "Cek ground kiri dan kanan.", "Ground aman, tidak putus.", True),
        ("Goyang kabel", "Goyang ringan soket dan sambungan.", "Tidak kedip, tidak putus.", True),
    ]
    return QcChecklistTemplate(
        product_sku=SKU,
        items=[
            QcChecklistItem(nama=n, cara_tes=ct, expected=e, required=r, urutan=i + 1)
            for i, (n, ct, e, r) in enumerate(items)
        ],
    )


def seed_common_mistakes():
    rows = [
        ("D", "Diode terbalik", "Low beam tidak ikut aktif saat high beam aktif.", "Cek tanda garis katoda sebelum crimp dan solder."),
        (None, "Pin 87 dan 87a pada relay AOD tertukar", "Devil eye tidak bekerja sesuai fungsi auto off.", "Selalu cek Relay 3 Pin Map sebelum pasang skun."),
        ("C", "Solder low beam cold solder", "Output low beam putus saat dipakai lama.", "Solder dengan timah cukup dan panas merata."),
        ("F", "Skun aki kendor", "Aki tidak konek, lampu tidak nyala.", "Gunakan skun bulat M6 dan crimp dengan kuat."),
    ]
    return [
        CommonMistake(
            product_sku=SKU, bundle_code=b, kesalahan=k, akibat=a, cara_mencegah=c,
        )
        for b, k, a, c in rows
    ]


def seed_revisions():
    return [
        RevisionHistory(
            product_sku=SKU, versi="V1",
            diubah_oleh="Arif", bagian_berubah="Initial release",
            alasan="Standarisasi produksi foglamp AOD H11.",
            catatan_approval="Approved oleh owner.",
        ),
    ]


def seed_training():
    rows = [
        ("Redi", "Trainer"),
        ("Windu", "Bisa mandiri"),
        ("Dede", "Bisa mandiri"),
        ("Fauzi", "Bisa dengan pengawasan"),
        ("Leni", "Bisa mandiri"),
        ("Arif", "Trainer"),
    ]
    return [
        TrainingMatrix(
            nama_karyawan=n, product_sku=SKU, skill_level=lvl,
            approved_by="Arif",
        )
        for n, lvl in rows
    ]


async def run_seed(db):
    """Idempotent seed - only runs if users collection is empty."""
    existing = await db.users.count_documents({})
    if existing > 0:
        return False

    await db.users.insert_many([u.model_dump() for u in seed_users()])
    await db.products.insert_many([p.model_dump() for p in seed_products()])
    await db.cable_functions.insert_many([c.model_dump() for c in seed_cable_functions()])
    await db.machine_programs.insert_many([m.model_dump() for m in seed_machine_programs()])
    await db.product_cables.insert_many([pc.model_dump() for pc in seed_product_cables()])
    await db.product_bundles.insert_many([pb.model_dump() for pb in seed_product_bundles()])
    await db.work_instructions.insert_many([wi.model_dump() for wi in seed_work_instructions()])
    await db.relay_pin_maps.insert_many([rpm.model_dump() for rpm in seed_pin_maps()])
    await db.qc_templates.insert_one(seed_qc_template().model_dump())
    await db.common_mistakes.insert_many([cm.model_dump() for cm in seed_common_mistakes()])
    await db.revision_history.insert_many([rh.model_dump() for rh in seed_revisions()])
    await db.training_matrix.insert_many([t.model_dump() for t in seed_training()])
    return True
