"""RelayLab Production OS - FastAPI main."""
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

app = FastAPI(title="RelayLab Production OS")
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
app.include_router(router)


@app.get("/api/")
async def api_root():
    return {"app": "RelayLab Production OS", "ok": True}
