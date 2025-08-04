# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from codegemma_router import router as codegemma_router

app = FastAPI()

# Optional: allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the CodeGemma router
app.include_router(codegemma_router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "CodeGemma FastAPI is running!"}

@app.get("/health")
def health_check():
    return {"ok": True}
