"""RelayLab Production System - FastAPI main."""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="RelayLab Production System")
app.state.db = db

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("relaylab")


@app.on_event("startup")
async def startup():
    from seed_data import run_seed
    inserted = await run_seed(db)
    if inserted:
        logger.info("Seed data created (initial).")
    # ensure indexes
    await db.users.create_index("username", unique=True)
    await db.sessions.create_index("token", unique=True)
    await db.products.create_index("sku", unique=True)
    await db.cable_functions.create_index("cable_code", unique=True)
    await db.machine_programs.create_index("nomor_program", unique=True)
    await db.work_orders.create_index("wo_number", unique=True)
    await db.file_assets.create_index("id", unique=True)
    await db.file_assets.create_index([("related_type", 1), ("related_id", 1), ("is_deleted", 1)])
    await db.operator_progress.create_index([("wo_number", 1), ("bundle_code", 1), ("step_number", 1)], unique=True)
    # init object storage (best-effort, app still serves if storage is down)
    try:
        from storage import init_storage
        init_storage()
        logger.info("Object storage initialized.")
    except Exception as e:
        logger.warning(f"Object storage init failed at startup: {e}. Uploads will retry lazily.")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# CORS
cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


from routes import router  # noqa: E402
from routes_uploads import router as uploads_router  # noqa: E402
app.include_router(router)
app.include_router(uploads_router)


@app.get("/api/")
async def api_root():
    return {"app": "RelayLab Production System", "ok": True}
