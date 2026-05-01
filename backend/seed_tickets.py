from datetime import datetime

from app.db import init_db, SessionLocal
from app.models import Ticket

sample_tickets = [
    {
        "original_message": "Users are unable to log in after the latest update.",
        "clarified_message": "Login failures occur for users after the new release; authentication service needs investigation.",
        "assigned_team": "Helpdesk",
        "priority": "P1",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "Invoices are not showing on the billing page.",
        "clarified_message": "Billing page fails to load invoices for some customers; possible database query issue.",
        "assigned_team": "Database Team",
        "priority": "P2",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "The VPN connection drops every hour on Windows machines.",
        "clarified_message": "Windows users experience VPN disconnects roughly every 60 minutes; network and VPN stability should be reviewed.",
        "assigned_team": "Network Support",
        "priority": "P2",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "We need a new policy for AWS S3 bucket permissions.",
        "clarified_message": "Create an AWS S3 access policy that secures internal bucket access while allowing reporting users to read files.",
        "assigned_team": "AWS Support",
        "priority": "P3",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "There is an error when uploading files bigger than 10MB.",
        "clarified_message": "Large file uploads above 10MB fail with a server-side error; investigate upload limits and storage service.",
        "assigned_team": "Development",
        "priority": "P2",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "Production payment API is down for all checkout transactions.",
        "clarified_message": "Checkout payment API outage is blocking all customer purchases in production; immediate restoration is required.",
        "assigned_team": "Development",
        "priority": "P1",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "Potential unauthorized admin access detected in cloud console.",
        "clarified_message": "Suspicious privileged access activity detected in cloud admin console; security incident response is needed immediately.",
        "assigned_team": "Security",
        "priority": "P1",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "Primary database CPU is at 99% and writes are timing out.",
        "clarified_message": "Primary database is saturated causing write timeout failures; urgent stabilization and performance remediation are required.",
        "assigned_team": "Database Team",
        "priority": "P1",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "Major packet loss between branch offices is impacting live calls.",
        "clarified_message": "Severe network packet loss across branch links is disrupting voice and video calls; high-priority network incident.",
        "assigned_team": "Network Support",
        "priority": "P2",
        "clarification_needed": False,
        "clarification_question": None,
    },
    {
        "original_message": "SSO login is intermittently failing for finance users before payroll cutoff.",
        "clarified_message": "Intermittent SSO failures are blocking finance user access near payroll deadline; urgent authentication support needed.",
        "assigned_team": "Helpdesk",
        "priority": "P2",
        "clarification_needed": False,
        "clarification_question": None,
    },
]


def seed_tickets():
    init_db()
    with SessionLocal() as session:
        existing_messages = {
            row[0]
            for row in session.query(Ticket.original_message).all()
        }
        inserted_count = 0

        for sample in sample_tickets:
            if sample["original_message"] in existing_messages:
                continue

            ticket = Ticket(
                ticket_number="",
                original_message=sample["original_message"],
                clarified_message=sample["clarified_message"],
                assigned_team=sample["assigned_team"],
                priority=sample["priority"],
                clarification_needed=sample["clarification_needed"],
                clarification_question=sample["clarification_question"],
                created_at=datetime.utcnow(),
            )
            session.add(ticket)
            session.flush()
            ticket.ticket_number = f"INC{ticket.id:08d}"
            inserted_count += 1

        session.commit()
        if inserted_count == 0:
            print(f"No new sample records added. Database already contains {len(existing_messages)} seeded messages.")
        else:
            print(f"Inserted {inserted_count} sample ticket(s).")


if __name__ == "__main__":
    seed_tickets()
