from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Business
from ..schemas import LoginRequest, OtpVerifyRequest, RegisterRequest, ResendOtpRequest
from ..security import business_public, create_access_token, get_current_business, hash_password, verify_password
from ..services.otp import issue_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])


def _otp_response(message: str, email: str, code: str) -> dict:
    body = {"message": message, "email": email, "otp_expires_minutes": settings.OTP_EXPIRE_MINUTES}
    if settings.OTP_DEV_MODE:
        body["demo_otp"] = code
    return body


def _by_email(db: Session, email: str) -> Business | None:
    return db.scalar(select(Business).where(func.lower(Business.email) == email.lower()))


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.lower()
    existing = _by_email(db, email)
    if existing and existing.is_verified:
        raise HTTPException(409, "This email is already registered. Please sign in.")

    clash = db.scalar(select(Business).where(
        or_(func.lower(Business.business_id) == req.business_id.lower(), Business.gst_number == req.gst_number),
        func.lower(Business.email) != email,
    ))
    if clash:
        field = "Business ID" if clash.business_id.lower() == req.business_id.lower() else "GST number"
        raise HTTPException(409, f"This {field} is already registered.")

    business = existing or Business(email=email)
    business.business_id = req.business_id
    business.name = req.name
    business.password_hash = hash_password(req.password)
    business.gst_number = req.gst_number
    business.phone = req.phone
    business.is_verified = False
    db.add(business)
    db.commit()

    code = issue_otp(db, email, "register")
    return _otp_response("Registration received. Enter the OTP to verify your email.", email, code)


@router.post("/register/verify")
def verify_registration(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    business = _by_email(db, req.email)
    if business is None:
        raise HTTPException(404, "No registration found for this email.")
    ok, message = verify_otp(db, req.email, "register", req.otp)
    if not ok:
        raise HTTPException(400, message)
    business.is_verified = True
    db.commit()
    return {"message": "Email verified. You can now sign in.", "email": business.email}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    ident = req.identifier.strip().lower()
    business = db.scalar(select(Business).where(
        or_(func.lower(Business.email) == ident, func.lower(Business.business_id) == ident)
    ))
    if business is None or not verify_password(req.password, business.password_hash):
        raise HTTPException(401, "Invalid Business ID / email or password.")
    if not business.is_verified:
        code = issue_otp(db, business.email, "register")
        raise HTTPException(403, {"message": "Email not verified yet. A new verification OTP has been sent.",
                                  "email": business.email, "needs_verification": True,
                                  **({"demo_otp": code} if settings.OTP_DEV_MODE else {})})
    code = issue_otp(db, business.email, "login")
    return _otp_response("Password verified. Enter the OTP sent to your registered email.", business.email, code)


@router.post("/login/verify")
def verify_login(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    business = _by_email(db, req.email)
    if business is None or not business.is_verified:
        raise HTTPException(404, "Business account not found.")
    ok, message = verify_otp(db, req.email, "login", req.otp)
    if not ok:
        raise HTTPException(400, message)
    return {"access_token": create_access_token(business), "token_type": "bearer",
            "expires_minutes": settings.JWT_EXPIRE_MINUTES, "business": business_public(business)}


@router.post("/resend-otp")
def resend_otp(req: ResendOtpRequest, db: Session = Depends(get_db)):
    business = _by_email(db, req.email)
    if business is None:
        raise HTTPException(404, "Business email is not registered.")
    if req.purpose == "login" and not business.is_verified:
        raise HTTPException(403, "Email not verified yet.")
    code = issue_otp(db, business.email, req.purpose)
    return _otp_response("A new OTP has been generated.", business.email, code)


@router.get("/me")
def me(business: Business = Depends(get_current_business)):
    return business_public(business)
