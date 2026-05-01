from datetime import datetime, timedelta
import os
from time import perf_counter
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field

from .agents import ALLOW_LOCAL_FALLBACK, call_aicafe, clarification_agent, classification_agent
from .auth import (
    create_access_token,
    generate_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from .db import SessionLocal, init_db
from .email_service import send_password_reset_email, send_verification_email
from .models import Feedback, Ticket, User


class ChatRequest(BaseModel):
    message: str
    history: List[str] = Field(default_factory=list)
    clarification_answer: str | None = None
    clarification_question: str | None = None


class ChatResponse(BaseModel):
    original_message: str
    clarified_message: str
    assigned_team: str
    priority: str | None = None
    created_at: datetime | None = None
    clarification_needed: bool
    clarification_question: str | None = None
    ticket_number: str | None = None
    response_time_ms: int | None = None
    response_source: str = "ai"  # "ai" or "fallback"


class TicketRead(BaseModel):
    ticket_number: str
    original_message: str
    clarified_message: str
    assigned_team: str
    priority: str
    clarification_needed: bool
    clarification_question: str | None = None
    created_at: datetime
    response_time_ms: int | None = None

    model_config = {"from_attributes": True}


class TicketUpdateRequest(BaseModel):
    original_message: str | None = None
    clarified_message: str | None = None
    assigned_team: str | None = None


class TicketCancelResponse(BaseModel):
    ticket_number: str
    cancelled: bool


# ── Auth schemas ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = Field(default="business_user", pattern="^(business_user|admin)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserRead


# ── Feedback schemas ──────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class FeedbackRead(BaseModel):
    id: int
    ticket_number: str | None = None
    user_email: str | None = None
    rating: int
    comment: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

app = FastAPI()

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/health/aicafe")
async def aicafe_health():
    try:
        response = await call_aicafe([
            {"role": "user", "content": "Reply with exactly: OK"}
        ])
        return {
            "status": "up",
            "aicafe_enabled": True,
            "fallback_enabled": ALLOW_LOCAL_FALLBACK,
            "detail": "AICafe service is reachable",
            "sample": (response or "")[:120],
        }
    except RuntimeError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "down",
                "aicafe_enabled": False,
                "fallback_enabled": ALLOW_LOCAL_FALLBACK,
                "detail": str(exc),
            },
        )


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    started_at = perf_counter()
    try:
        clarification = await clarification_agent(
            request.message,
            request.history,
            request.clarification_answer,
            request.clarification_question,
        )
        clarification_source = clarification.pop("source", "ai")
        
        triage = (
            {"team": "Pending clarification", "priority": None, "source": clarification_source}
            if clarification["clarification_needed"]
            else await classification_agent(
                clarification["clarified_message"],
                clarification.get("urgency_context"),
            )
        )
        assigned_team = triage["team"]
        priority = triage["priority"]
        classification_source = triage.pop("source", "ai")
        
        # Use classification source if available (more decisive), else use clarification source
        response_source = classification_source if not clarification["clarification_needed"] else clarification_source

        payload = {
            "original_message": request.message,
            "clarified_message": clarification["clarified_message"],
            "assigned_team": assigned_team,
            "priority": priority,
            "created_at": None,
            "clarification_needed": clarification["clarification_needed"],
            "clarification_question": clarification.get("clarification_question"),
            "ticket_number": None,
            "response_time_ms": None,
            "response_source": response_source,
        }

        response_time_ms = int((perf_counter() - started_at) * 1000)
        payload["response_time_ms"] = response_time_ms

        if not clarification["clarification_needed"]:
            with SessionLocal() as session:
                ticket = Ticket(
                    ticket_number="",
                    original_message=request.message,
                    clarified_message=clarification["clarified_message"],
                    assigned_team=assigned_team,
                    priority=priority or "P3",
                    clarification_needed=False,
                    clarification_question=clarification.get("clarification_question"),
                    response_time_ms=response_time_ms,
                )
                session.add(ticket)
                session.flush()
                ticket.ticket_number = f"INC{ticket.id:08d}"
                session.commit()
                payload["ticket_number"] = ticket.ticket_number
                payload["created_at"] = ticket.created_at

        return payload
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected server error while processing ticket") from exc


@app.get("/tickets", response_model=List[TicketRead])
def list_tickets():
    with SessionLocal() as session:
        tickets = session.query(Ticket).order_by(Ticket.id.desc()).all()
        return tickets


@app.put("/tickets/{ticket_number}", response_model=TicketRead)
def update_ticket(ticket_number: str, request: TicketUpdateRequest):
    with SessionLocal() as session:
        ticket = session.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        if request.original_message is not None:
            original = request.original_message.strip()
            if not original:
                raise HTTPException(status_code=400, detail="original_message cannot be empty")
            ticket.original_message = original

        if request.clarified_message is not None:
            clarified = request.clarified_message.strip()
            if not clarified:
                raise HTTPException(status_code=400, detail="clarified_message cannot be empty")
            ticket.clarified_message = clarified

        if request.assigned_team is not None:
            assigned_team = request.assigned_team.strip()
            if not assigned_team:
                raise HTTPException(status_code=400, detail="assigned_team cannot be empty")
            ticket.assigned_team = assigned_team

        session.commit()
        session.refresh(ticket)
        return ticket


@app.post("/tickets/{ticket_number}/cancel", response_model=TicketCancelResponse)
def cancel_ticket(ticket_number: str):
    with SessionLocal() as session:
        ticket = session.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        ticket.assigned_team = "Cancelled"
        ticket.priority = "P4"
        ticket.clarification_needed = False
        ticket.clarification_question = "Cancelled by user"
        session.commit()

        return {"ticket_number": ticket.ticket_number, "cancelled": True}


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserRead, status_code=201)
async def register(request: RegisterRequest):
    with SessionLocal() as session:
        existing = session.query(User).filter(User.email == request.email.lower()).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        verification_token = generate_token()
        user = User(
            email=request.email.lower().strip(),
            full_name=request.full_name.strip(),
            hashed_password=hash_password(request.password),
            role=request.role,
            is_verified=False,
            reset_token=verification_token,
            reset_token_expiry=datetime.utcnow() + timedelta(hours=24),
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    send_verification_email(user.email, user.full_name, verification_token)
    return user


@app.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest):
    with SessionLocal() as session:
        user = session.query(User).filter(User.email == request.email.lower()).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id, user.role, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@app.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    with SessionLocal() as session:
        user = session.query(User).filter(User.email == request.email.lower()).first()
        if user:
            reset_token = generate_token()
            user.reset_token = reset_token
            user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
            session.commit()
            send_password_reset_email(user.email, user.full_name, reset_token)
    # Always return 200 to prevent email enumeration
    return {"detail": "If an account with that email exists, a reset link has been sent."}


@app.post("/auth/reset-password")
def reset_password(request: ResetPasswordRequest):
    with SessionLocal() as session:
        user = session.query(User).filter(
            User.reset_token == request.token,
            User.reset_token_expiry > datetime.utcnow(),
        ).first()
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        user.hashed_password = hash_password(request.new_password)
        user.reset_token = None
        user.reset_token_expiry = None
        session.commit()
    return {"detail": "Password reset successfully"}


@app.get("/auth/verify")
def verify_email(token: str):
    with SessionLocal() as session:
        user = session.query(User).filter(
            User.reset_token == token,
            User.reset_token_expiry > datetime.utcnow(),
        ).first()
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired verification token")

        user.is_verified = True
        user.reset_token = None
        user.reset_token_expiry = None
        session.commit()
    return {"detail": "Email verified successfully"}


@app.get("/auth/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Feedback endpoints ────────────────────────────────────────────────────────

@app.post("/tickets/{ticket_number}/feedback", response_model=FeedbackRead, status_code=201)
def submit_feedback(
    ticket_number: str,
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user),
):
    with SessionLocal() as session:
        existing = session.query(Feedback).filter(
            Feedback.ticket_number == ticket_number,
            Feedback.user_email == current_user.email,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Feedback already submitted for this ticket")

        fb = Feedback(
            ticket_number=ticket_number,
            user_email=current_user.email,
            rating=request.rating,
            comment=request.comment,
        )
        session.add(fb)
        session.commit()
        session.refresh(fb)
        return fb


@app.get("/admin/feedbacks", response_model=List[FeedbackRead])
def list_feedbacks(current_user: User = Depends(require_admin)):
    with SessionLocal() as session:
        return session.query(Feedback).order_by(Feedback.id.desc()).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)