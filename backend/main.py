"""
main.py — Football Tracking Analytics API

Entry point for the FastAPI application.
Run with:
    uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import match, upload, analytics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Directories ──────────────────────────────────────────────────────────────
DATA_RAW = Path("data/raw")
DATA_PROCESSED = Path("data/processed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle handler."""
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    logger.info("Football Tracking API started — data dirs ready.")
    yield
    logger.info("Football Tracking API shutting down.")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Football Tracking Analytics API",
    description="Real-time football tracking data visualisation — Phase 1 backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(match.router)
app.include_router(upload.router)
app.include_router(analytics.router)


# ─── Root & health ────────────────────────────────────────────────────────────
@app.get("/")
def root() -> dict:
    return {
        "status": "ok",
        "message": "Football Tracking API running",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "healthy"}
