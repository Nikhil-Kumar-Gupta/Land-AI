"""SQLAlchemy models.

Case records are imported from data/land_acquisition_dataset.csv (a SYNTHETIC dataset). Budget fields
(estimated_cost, utilized_amount, actual_cost) are SYNTHETIC values derived from the dataset's compensation amount
during import (see scripts/seed.py) and flagged with finance_is_synthetic=True. Nothing here is real government data.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import IS_POSTGRES
from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    gst_number: Mapped[str] = mapped_column(String(15), unique=True)
    phone: Mapped[str] = mapped_column(String(15))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    purpose: Mapped[str] = mapped_column(String(20))  # "register" | "login"
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (UniqueConstraint("state", "name", name="uq_district_state_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), index=True)
    state: Mapped[str] = mapped_column(String(80), index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)  # district HQ, not case location
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    cases: Mapped[list["AcquisitionCase"]] = relationship(back_populates="district_ref")


class Project(Base):
    """Projects are groups of cases by project type and state (the dataset has no project names)."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    project_type: Mapped[str] = mapped_column(String(50), index=True)
    state: Mapped[str] = mapped_column(String(80))
    districts: Mapped[str] = mapped_column(String(300))
    total_budget: Mapped[float] = mapped_column(Float)  # INR, SYNTHETIC (derived)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)

    cases: Mapped[list["AcquisitionCase"]] = relationship(back_populates="project")


class AcquisitionCase(Base):
    __tablename__ = "acquisition_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    state: Mapped[str] = mapped_column(String(80), index=True)
    district: Mapped[str] = mapped_column(String(80), index=True)

    acquisition_stage: Mapped[str] = mapped_column(String(60), index=True)
    stage_index: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), index=True)
    priority: Mapped[str] = mapped_column(String(20), index=True)
    project_category: Mapped[str] = mapped_column(String(60))
    zone: Mapped[str] = mapped_column(String(20), index=True)  # ready | not_ready (services/zones.py)

    # Model input factors (from the dataset)
    land_area_acres: Mapped[float] = mapped_column(Float)
    number_of_landowners: Mapped[float] = mapped_column(Float)
    number_of_land_parcels: Mapped[float] = mapped_column(Float)
    affected_villages: Mapped[float] = mapped_column(Float)
    affected_households: Mapped[float] = mapped_column(Float)
    private_land_pct: Mapped[float] = mapped_column(Float)
    government_land_pct: Mapped[float] = mapped_column(Float)
    approval_pending: Mapped[float] = mapped_column(Float)
    notification_pending: Mapped[float] = mapped_column(Float)
    compensation_pending: Mapped[float] = mapped_column(Float)
    compensation_amount_lakh: Mapped[float] = mapped_column(Float)
    budget_release_delay_days: Mapped[float] = mapped_column(Float)
    dispute_count: Mapped[float] = mapped_column(Float)
    court_case: Mapped[float] = mapped_column(Float)
    objection_count: Mapped[float] = mapped_column(Float)
    survey_completed: Mapped[float] = mapped_column(Float)
    ownership_verification_pending: Mapped[float] = mapped_column(Float)
    pending_documents: Mapped[float] = mapped_column(Float)
    missing_documents: Mapped[float] = mapped_column(Float)
    days_in_current_stage: Mapped[float] = mapped_column(Float)
    previous_stage_delay_days: Mapped[float] = mapped_column(Float)
    total_processing_days: Mapped[float] = mapped_column(Float)
    staff_workload_ratio: Mapped[float] = mapped_column(Float)
    seasonal_factor: Mapped[float] = mapped_column(Float)
    district_historical_delay_rate: Mapped[float] = mapped_column(Float)
    historical_average_delay_days: Mapped[float] = mapped_column(Float)
    similar_case_average_delay_days: Mapped[float] = mapped_column(Float)
    imputed_fields: Mapped[str | None] = mapped_column(String(400), nullable=True)

    # Recorded outcomes from the dataset (not model inputs)
    delayed_recorded: Mapped[int] = mapped_column(Integer)
    recorded_additional_delay_days: Mapped[float] = mapped_column(Float)

    # Financials in INR. compensation_amount comes from the dataset; the others are SYNTHETIC (derived at import).
    compensation_amount: Mapped[float] = mapped_column(Float)
    estimated_cost: Mapped[float] = mapped_column(Float)
    utilized_amount: Mapped[float] = mapped_column(Float)
    actual_cost: Mapped[float] = mapped_column(Float)
    finance_is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)

    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)

    project: Mapped[Project] = relationship(back_populates="cases")
    district_ref: Mapped[District] = relationship(back_populates="cases")
    prediction: Mapped["Prediction | None"] = relationship(
        back_populates="case", uselist=False, cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(back_populates="case", cascade="all, delete-orphan")


if IS_POSTGRES:
    from geoalchemy2 import Geometry

    # PostGIS point for the district HQ (GiST-indexed by GeoAlchemy2).
    District.geom = mapped_column(Geometry("POINT", srid=4326), nullable=True)


class Prediction(Base):
    """Current persisted ML prediction per case - the single source of truth for every page."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("acquisition_cases.id", ondelete="CASCADE"), unique=True)
    risk_probability: Mapped[float] = mapped_column(Float, index=True)
    risk_level: Mapped[str] = mapped_column(String(10), index=True)
    predicted_delay_days: Mapped[float] = mapped_column(Float)
    base_risk: Mapped[float] = mapped_column(Float)
    base_delay: Mapped[float] = mapped_column(Float)
    top_risk_factor: Mapped[str] = mapped_column(String(80))
    top_delay_driver: Mapped[str] = mapped_column(String(80))
    shap_risk: Mapped[list] = mapped_column(JSON)
    shap_delay: Mapped[list] = mapped_column(JSON)
    model_version: Mapped[str] = mapped_column(String(40))
    scored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    case: Mapped[AcquisitionCase] = relationship(back_populates="prediction")


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("case_id", "alert_type", name="uq_alert_case_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("acquisition_cases.id", ondelete="CASCADE"), index=True)
    alert_type: Mapped[str] = mapped_column(String(30))  # HIGH_RISK | COST_OVERRUN | DELAY
    severity: Mapped[str] = mapped_column(String(10), index=True)  # critical | high | medium
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(String(500))
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    case: Mapped[AcquisitionCase] = relationship(back_populates="alerts")


Index("ix_cases_project_stage", AcquisitionCase.project_id, AcquisitionCase.stage_index)
Index("ix_cases_district_zone", AcquisitionCase.district_id, AcquisitionCase.zone)
