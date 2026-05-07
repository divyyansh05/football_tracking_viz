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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
# Note: Router prefixes (e.g., /api/match) are defined within the router files
app.include_router(match.router)
app.include_router(upload.router)
app.include_router(analytics.router)


# ─── API Health Check ─────────────────────────────────────────────────────────
# This stays as a fallback for testing
@app.get("/api/health")
def health() -> dict:
    return {"status": "healthy"}


# ─── Static Files (Frontend) ──────────────────────────────────────────────────
# In production (Docker), the frontend build is copied to /app/static
static_path = Path("static")
if static_path.exists():
    # Mount assets (CSS/JS)
    if (static_path / "assets").exists():
        app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")

    # Catch-all for React client-side routing
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # 1. Check if the path is a file (e.g. logo.png, robots.txt)
        file_path = static_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # 2. Otherwise serve index.html (React handles routing)
        index_file = static_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        
        return {"error": "Frontend not found"}
else:
    # Local development fallbacks
    @app.get("/")
    def root() -> dict:
        return {
            "status": "ok",
            "message": "Football Tracking API running",
            "docs": "/api/docs",
        }
