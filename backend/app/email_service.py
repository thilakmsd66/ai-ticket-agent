import os
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "2525"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "thilakmsd66@gmail.com")
APP_URL = os.getenv("APP_URL", "http://localhost:5175")


def _send(to: str, subject: str, html: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        print(f"[Email MOCK] To: {to} | Subject: {subject}")
        links = re.findall(r'href="([^"]+)"', html)
        for link in links:
            print(f"[Email MOCK] Link: {link}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, [to], msg.as_string())
        print(f"[Email SENT] To: {to} | Subject: {subject}")
    except Exception as exc:
        print(f"[Email ERROR] Failed to send email to {to}: {exc}")


def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    link = f"{APP_URL}/?verify={token}"
    _send(
        to=to_email,
        subject="Verify your AI Ticket Agent account",
        html=f"""
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;">
          <h2 style="color:#0f172a;">Hi {full_name},</h2>
          <p style="color:#475569;">Welcome to AI Ticket Agent! Click below to verify your email address.</p>
          <a href="{link}"
             style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);
                    color:white;padding:12px 28px;border-radius:8px;text-decoration:none;
                    font-weight:700;margin:16px 0;">
            Verify Account
          </a>
          <p style="color:#94a3b8;font-size:0.85rem;">This link expires in 24 hours.</p>
        </div>
        """,
    )


def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    link = f"{APP_URL}/?reset={token}"
    _send(
        to=to_email,
        subject="Reset your AI Ticket Agent password",
        html=f"""
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;">
          <h2 style="color:#0f172a;">Hi {full_name},</h2>
          <p style="color:#475569;">We received a request to reset your password.</p>
          <a href="{link}"
             style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);
                    color:white;padding:12px 28px;border-radius:8px;text-decoration:none;
                    font-weight:700;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:0.85rem;">
            This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.
          </p>
        </div>
        """,
    )
