"""Application settings, loaded from backend_py/.env (see .env.example)."""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

logger = logging.getLogger("sanket")


def _bool(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes"}


class Settings:
    # PostgreSQL + PostGIS is the target database, e.g.
    #   postgresql+psycopg2://postgres:password@localhost:5432/sanket_ai
    # If DATABASE_URL is not set, a local SQLite file is used for development only.
    DATABASE_URL: str = os.getenv("DATABASE_URL") or f"sqlite:///{(BASE_DIR / 'sanket_dev.db').as_posix()}"

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-only-change-this-secret")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

    OTP_EXPIRE_MINUTES: int = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
    OTP_MAX_ATTEMPTS: int = 5
    # In dev mode the OTP is returned in the API response and shown on screen (existing demo behaviour).
    OTP_DEV_MODE: bool = _bool("OTP_DEV_MODE", "true")

    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")

    CORS_ORIGINS: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
    ]

    ARTIFACT_DIR: Path = BASE_DIR / "model_artifacts"
    DATA_DIR: Path = BASE_DIR / "data"
    # Land-acquisition dataset (CSV or Excel). See app/ml/dataset.py for the required columns.
    DATASET_PATH: Path = Path(os.getenv("DATASET_PATH") or (BASE_DIR / "data" / "land_acquisition_dataset.csv"))


settings = Settings()
IS_POSTGRES = settings.DATABASE_URL.startswith("postgresql")
