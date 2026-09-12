import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import logger, settings
from ..models import OtpCode


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


def issue_otp(db: Session, email: str, purpose: str) -> str:
    email = email.lower()
    db.execute(update(OtpCode).where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.consumed.is_(False))
               .values(consumed=True))
    code = f"{secrets.randbelow(900000) + 100000}"
    db.add(OtpCode(email=email, purpose=purpose, code_hash=_hash(code),
                   expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)))
    db.commit()
    _deliver(email, code, purpose)
    return code


def verify_otp(db: Session, email: str, purpose: str, code: str) -> tuple[bool, str]:
    email = email.lower()
    record = db.scalars(
        select(OtpCode).where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.consumed.is_(False))
        .order_by(OtpCode.created_at.desc())
    ).first()
    if record is None:
        return False, "OTP not found. Please request a new OTP."
    if datetime.now(timezone.utc) > _as_aware(record.expires_at):
        record.consumed = True
        db.commit()
        return False, "OTP has expired. Please request a new OTP."
    if record.attempts >= settings.OTP_MAX_ATTEMPTS:
        record.consumed = True
        db.commit()
        return False, "Too many incorrect attempts. Please request a new OTP."
    if not secrets.compare_digest(record.code_hash, _hash(code)):
        record.attempts += 1
        db.commit()
        return False, "Invalid OTP."
    record.consumed = True
    db.commit()
    return True, "OTP verified."


def _deliver(email: str, code: str, purpose: str) -> None:
    logger.info("OTP for %s (%s): %s", email, purpose, code if settings.OTP_DEV_MODE else "******")
    if not settings.SMTP_HOST:
        return
    msg = EmailMessage()
    msg["Subject"] = "LandAI verification code"
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = email
    msg.set_content(f"Your LandAI {purpose} verification code is {code}. It expires in "
                    f"{settings.OTP_EXPIRE_MINUTES} minutes.")
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception as exc:  # delivery failure should not leak details to the client
        logger.error("OTP email delivery failed: %s", exc)
