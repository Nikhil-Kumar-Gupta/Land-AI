import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import IS_POSTGRES, logger, settings
from .database import check_db, init_db
from .ml.inference import ModelNotTrainedError
from .routers import alerts, auth, cases, ml, portfolio

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="LandAI - Land Acquisition Delay Prediction API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.exception_handler(ModelNotTrainedError)
async def model_not_trained(_: Request, exc: ModelNotTrainedError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error. Please try again."})


@app.get("/api/health")
def health():
    return {"status": "ok", "database": "up" if check_db() else "down",
            "database_engine": "postgresql" if IS_POSTGRES else "sqlite"}


for r in (auth.router, cases.router, portfolio.router, alerts.router, ml.router):
    app.include_router(r, prefix="/api")
