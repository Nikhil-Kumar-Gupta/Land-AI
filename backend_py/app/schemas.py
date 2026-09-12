import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from .ml.features import PRIORITIES, PROJECT_CATEGORIES, PROJECT_TYPES, STAGES

GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


class RegisterRequest(BaseModel):
    business_id: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    name: str | None = Field(default=None, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    gst_number: str
    phone: str

    @field_validator("gst_number")
    @classmethod
    def _gst(cls, v: str) -> str:
        v = v.strip().upper()
        if not GST_RE.match(v):
            raise ValueError("Enter a valid 15-character GSTIN (e.g. 36ABCDE1234F1Z5).")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            raise ValueError("Enter a valid 10-digit Indian mobile number.")
        return digits

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must contain at least one letter and one number.")
        return v


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255, description="Business email or Business ID")
    password: str = Field(min_length=1, max_length=128)


class ResendOtpRequest(BaseModel):
    email: EmailStr
    purpose: Literal["register", "login"]


class SimulationRequest(BaseModel):
    changes: dict[str, float] = Field(default_factory=dict)


class AssessmentRequest(BaseModel):
    """Ad-hoc assessment of a proposed acquisition (not persisted). Omitted factors default to dataset medians."""
    project_type: Literal[tuple(PROJECT_TYPES)]  # type: ignore[valid-type]
    acquisition_stage: Literal[tuple(STAGES)]  # type: ignore[valid-type]
    priority: Literal[tuple(PRIORITIES)] = "Normal"  # type: ignore[valid-type]
    project_category: Literal[tuple(PROJECT_CATEGORIES)] = "Major Infrastructure"  # type: ignore[valid-type]
    features: dict[str, float] = Field(default_factory=dict)
