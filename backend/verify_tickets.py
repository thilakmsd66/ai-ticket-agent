from app.db import SessionLocal, init_db
from app.models import Ticket

init_db()
with SessionLocal() as session:
    tickets = session.query(Ticket).order_by(Ticket.id.desc()).limit(5).all()
    print('count:', session.query(Ticket).count())
    for ticket in tickets:
        print(ticket.ticket_number, ticket.original_message)
