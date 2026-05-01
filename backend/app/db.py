from datetime import datetime
from pathlib import Path
from sqlite3 import DatabaseError as SQLiteDatabaseError
import shutil

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "tickets.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)
Base = declarative_base()


def init_db() -> None:
    from .models import Ticket, User, Feedback  # noqa: F401

    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as connection:
            columns = connection.execute(text("PRAGMA table_info(tickets)"))
            column_names = {row[1] for row in columns}
            if "priority" not in column_names:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN priority VARCHAR(2) DEFAULT 'P3'"))
                connection.execute(text("UPDATE tickets SET priority = 'P3' WHERE priority IS NULL"))
            if "response_time_ms" not in column_names:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN response_time_ms INTEGER"))
    except Exception as exc:
        message = str(exc).lower()
        if isinstance(exc, SQLiteDatabaseError) or "malformed" in message:
            backup_path = BASE_DIR / f"tickets.corrupt.{datetime.utcnow():%Y%m%d%H%M%S}.db"
            if DB_PATH.exists():
                engine.dispose()
                shutil.move(str(DB_PATH), str(backup_path))
            Base.metadata.create_all(bind=engine)
        else:
            raise
