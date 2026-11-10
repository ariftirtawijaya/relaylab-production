"""Seed data for RelayLab Production System - Foglamp AOD product."""
import os

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
            password_hash=hash_password(os.environ.get("SEED_ADMIN_PASSWORD") or "admin123"), role="Admin",
        ),
        UserDoc(
            name="Redi", username="redi", email="redi@relaylab.local",
            password_hash=hash_password(os.environ.get("SEED_PRODUCTION_PASSWORD") or "prod123"), role="Production",
        ),
        UserDoc(
            name="Leni", username="leni", email="leni@relaylab.local",
            password_hash=hash_password(os.environ.get("SEED_QC_PASSWORD") or "qc123"), role="QC",
        ),
        UserDoc(
            name="Windu", username="windu", email="windu@relaylab.local",
            password_hash=hash_password(os.environ.get("SEED_PRODUCTION_PASSWORD") or "prod123"), role="Production",
        ),
        UserDoc(
            name="Dede", username="dede", email="dede@relaylab.local",
            password_hash=hash_password(os.environ.get("SEED_PRODUCTION_PASSWORD") or "prod123"), role="Production",
        ),
        UserDoc(
            name="Fauzi", username="fauzi", email="fauzi@relaylab.local",
            password_hash=hash_password(os.environ.get("SEED_PRODUCTION_PASSWORD") or "prod123"), role="Production",
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
