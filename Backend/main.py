from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from Backend.config.settings import settings
from Backend.Database.db import init_db
from Backend.Routes.api import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure SQLite tables and seeds are present
    print(f"[*] Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    init_db()
    print("[*] Ready to accept requests.")
    yield
    print("[*] Shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Dual-sided Campus Space Management & Real-Time Conflict Engine for Datathon",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
        "endpoints": {
            "room_matching": "/api/rooms/match (POST)",
            "room_timeline": "/api/rooms/{room_id}/timeline (GET)",
            "campus_overview": "/api/rooms/overview (GET)",
            "submit_request": "/api/requests/submit (POST)",
            "recent_requests": "/api/requests/recent (GET)",
            "admin_analytics": "/api/admin/analytics (GET)",
            "demand_forecasting": "/api/admin/demand-forecasting (GET)",
            "relocation_suggestions": "/api/admin/relocation-suggestions (GET)",
            "auto_allocate": "/api/admin/auto-allocate (POST)",
            "rooms_list": "/api/rooms/list (GET)"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("Backend.main:app", host="127.0.0.1", port=8000, reload=True)
