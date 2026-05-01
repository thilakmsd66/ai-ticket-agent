from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="business_user")
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    reset_token = Column(String(255), nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(32), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(32), unique=True, index=True, nullable=False)
    original_message = Column(Text, nullable=False)
    clarified_message = Column(Text, nullable=False)
    assigned_team = Column(String(128), nullable=False)
    priority = Column(String(2), nullable=False, default="P3")
    clarification_needed = Column(Boolean, default=False, nullable=False)
    clarification_question = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
