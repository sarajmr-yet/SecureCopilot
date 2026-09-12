from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.auth_routes import router as auth_router
from app.core.config import init_db

app = FastAPI(
    title="Secure Copilot API",
    description="AI-Powered DevSecOps Toolchain for Python Application Security",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()
    print("Database initialized ✅")

app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1/auth")

@app.get("/")
async def root():
    return {
        "message": "Secure Copilot API is running",
        "version": "2.0.0"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}