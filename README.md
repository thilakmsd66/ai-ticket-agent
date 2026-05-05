# AI Ticket Agent — IntelliTriage

IntelliTriage is a full-stack internal support ticketing application with AI-driven ticket clarification and routing. The product surface is branded as **IntelliTriage** in the UI; the repository keeps the original `ai-ticket-agent` name.

The project includes:
- a FastAPI backend for authentication, ticket lifecycle, feedback, and AI integration
- a React + Vite frontend with an animated hero, AI Companion ticket page, dashboards, admin feedback review, and voice-assisted flows
- deterministic clarification guardrails on the backend that validate AI behavior before creating a ticket
- Podman container support for local packaged execution
- SQLite storage for local development and demo use
- a Python script (`create_project_ppt.py`) that produces a branded animated project deck

## What The App Does

Users can:
- register and sign in
- request password reset and email verification links
- submit ticket descriptions to the AI chat endpoint via text or voice
- press **Ctrl+Enter** / **Cmd+Enter** in the description box to submit without leaving the keyboard
- receive a single targeted AI clarification question when the request is missing system, issue, impact, or urgency
- skip clarification automatically when the original request already contains enough context
- create tickets with assigned team and priority once enough detail is available
- review and update ticket history
- submit feedback on AI-assisted tickets

Admins can:
- view feedback submitted by users

## Current Runtime Model

This project is currently configured for AI-only routing.

- AI clarification and classification are performed through HCL AICafe
- local fallback routing has been removed from backend runtime code
- if AICafe is unavailable or the account is suspended, `/chat` returns `503`

### Clarification guardrails (bidirectional)

The `/chat` endpoint does not blindly trust the model. `backend/app/agents.py` extracts deterministic clarity signals from the user's text:

- `has_system` — keywords like app, portal, vpn, email, database, sap, oracle, …
- `has_issue` — keywords like cannot, unable, error, down, slow, …
- `has_impact` — keywords like users, team, customer, business, affected, …
- `has_urgency` — keywords like urgent, asap, eod, critical, p1, …

A request is considered clarity-complete when it has **system + issue + (impact OR urgency)**.

- If the request is **complete**, the backend bypasses the clarification step even if the model suggested a question, and creates the ticket directly. When a follow-up answer is provided, the original message and the answer are combined before classification.
- If the request is **incomplete** (or under 8 words), the backend forces a clarification turn and falls back to a default question that explicitly lists the missing fields.

This keeps the conversation deterministic regardless of model variance.

## Project Structure

```text
ai-ticket-agent/
├─ README.md
├─ podman-compose.yml
├─ create_project_ppt.py            # builds the branded animated project deck
├─ AI-Ticket-Agent-Project-Deck.pptx
├─ ppt_media_dump/                  # background assets for the deck
├─ backend/
│  ├─ .env.example
│  ├─ Containerfile
│  ├─ requirements.txt
│  ├─ run.ps1
│  ├─ invoke_ai_test.py
│  └─ app/
│     ├─ agents.py
│     ├─ auth.py
│     ├─ db.py
│     ├─ email_service.py
│     ├─ main.py
│     └─ models.py
└─ frontend/
   ├─ Containerfile
   ├─ package.json
   ├─ run.ps1
   └─ src/
      ├─ App.jsx                    # hero, brand, hero feature cards, routing
      ├─ App.css                    # animations: clarification, voice wave, routing, badges
      ├─ config.js
      ├─ context/
      └─ components/
         ├─ TicketAgentPage.jsx     # text + voice form, Ctrl+Enter submit
         ├─ AnalyticalDashboard.jsx # charts and metrics
         ├─ NavBar.jsx
         ├─ UserGuide.jsx
         ├─ UserProfile.jsx
         └─ ImageCarousel.jsx
```

## Architecture Overview

### Frontend

- React 18 + Vite
- API base URL is derived from `VITE_API_BASE_URL`
- Main application shell lives in `frontend/src/App.jsx`
- Authentication state is handled by `frontend/src/context/AuthContext.jsx`
- Brand: **IntelliTriage** (hero, navigation, footer)

Home / hero contains:
- live signal row (Avg AI Response · Critical Queue · Latest Ticket)
- four feature cards: AI-Powered Routing · Auto Clarification · Real-Time Processing · Live Analytics (these were consolidated from the old dashboard cards to remove duplication)

Main UI areas:
- AI Companion ticket submission with **Ctrl+Enter / Cmd+Enter** submit shortcut
- Animated clarification banner with question icon, audio wave on voice listen, and original-text recap
- Ticket History
- Analytical Dashboard (charts + priority strip)
- User Guide
- Admin Feedback page
- Voice Assistant modal

UI animation utilities live in `frontend/src/App.css` and include `clarificationPulse`, `iconBlink`, `helpPulse`, `questionSlideIn`, `iconFloat`, `voiceRing`, `wavePulse`, `originalSlideIn`, `routingIconRotate`, `dotPulse`, `arrowFlow`, `iconBounce`, `sparkle`, `badgeGlow`, and `fallbackGlow`.

### Backend

- FastAPI application in `backend/app/main.py`
- AI call orchestration in `backend/app/agents.py`
- JWT auth helpers in `backend/app/auth.py`
- SQLAlchemy models in `backend/app/models.py`
- SQLite database access in `backend/app/db.py`
- SMTP email handling in `backend/app/email_service.py`

### Database

- SQLite file: `backend/tickets.db`
- Used for users, tickets, and feedback records
- Intended for local development / demo workflows

### Containers

- Backend container exposes port `8080`
- Frontend container serves built static assets through Nginx on port `3000`

## API Overview

### Health

- `GET /health/aicafe`

### Chat

- `POST /chat`
- `GET /chat` returns usage guidance

### Tickets

- `GET /tickets`
- `HEAD /tickets`
- `PUT /tickets/{ticket_number}`
- `POST /tickets/{ticket_number}/cancel`
- `POST /tickets/{ticket_number}/feedback`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/verify`
- `GET /auth/me`

### Admin

- `GET /admin/feedbacks`

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and provide real values.

Required / important variables:

```env
API_KEY=your-aicafe-api-key
AICAFE_VERIFY_SSL=false
AICAFE_BASE_URL=https://aicafe.hcl.com
AICAFE_DEPLOYMENT_NAME=gpt-4.1
AICAFE_API_VERSION=2024-02-15-preview
ALLOW_LOCAL_FALLBACK=false

JWT_SECRET=replace-with-long-random-secret

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=you@example.com

APP_URL=http://localhost:3000
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Notes:
- `APP_URL` is used to generate password reset and verification links in email messages
- `FRONTEND_ORIGINS` must include every frontend origin that will call the backend
- `ALLOW_LOCAL_FALLBACK` should remain `false` for the current AI-only behavior

## Local Development Setup

### Prerequisites

- Python 3.10+
- Node.js 20+
- npm
- Podman if you want to run the containerized stack
- A valid HCL AICafe key and active quota/subscription

### 1. Backend setup

```powershell
cd backend
python -m pip install -r requirements.txt
```

Run backend locally:

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

### 2. Frontend setup

```powershell
cd frontend
npm install
```

Run frontend locally:

```powershell
cd frontend
npm run dev
```

By default:
- frontend dev server runs on Vite port such as `5173`
- backend runs on `8080`

## Running With Podman

### Build backend image

```powershell
cd backend
podman build --tls-verify=false -t ai-ticket-backend -f Containerfile .
```

### Build frontend image

```powershell
cd frontend
podman build --tls-verify=false --build-arg VITE_API_BASE_URL=http://localhost:8080 -t ai-ticket-frontend -f Containerfile .
```

### Start containers manually

```powershell
cd ..
podman machine start
podman network create ai-ticket-net
podman run -d --name ai-ticket-backend --network ai-ticket-net -p 8080:8080 --env-file backend/.env localhost/ai-ticket-backend:latest
podman run -d --name ai-ticket-frontend --network ai-ticket-net -p 3000:80 localhost/ai-ticket-frontend:latest
```

### Or use compose file

```powershell
podman compose up --build
```

Application URLs:
- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`

## PowerShell Shortcuts

Available helper scripts:
- `backend/run.ps1`
- `frontend/run.ps1`

Use them when you want a simple local start from PowerShell without typing the full command set.

## End-To-End Test Flow

Recommended verification flow:

1. Open `http://localhost:3000`
2. Register a user
3. Trigger forgot password
4. Log in
5. Submit a ticket in AI Companion
6. Verify a ticket is created and visible in Ticket History
7. Verify Admin Feedback page with an admin account

Expected ticket creation flow:
- frontend sends `POST /chat`
- backend asks AI for clarification if needed
- backend asks AI for team + priority classification once clarified
- backend stores the ticket in SQLite
- frontend displays ticket number, team, and priority

## Direct AI Connectivity Test

Use the dedicated backend script to call AICafe directly:

```powershell
cd backend
python invoke_ai_test.py
```

Or inside the backend image:

```powershell
cd ..
podman run --rm --env-file backend/.env localhost/ai-ticket-backend:latest python /app/invoke_ai_test.py
```

This is useful to separate provider issues from app issues.

## Troubleshooting

### `405 Method Not Allowed` on `/tickets`

- The backend now supports `HEAD /tickets`
- If you still see this in browser console, hard refresh the frontend so old JavaScript is not cached

### `503 Service Unavailable` on `/chat`

- In AI-only mode, this means the upstream AI provider rejected or could not process the request
- Check `GET /health/aicafe`
- Run `backend/invoke_ai_test.py`

### AICafe token-limit / suspension error

If you see a response like this:

```json
{"detail":"AICafe access is suspended due to token limit. Please contact support to restore API access."}
```

Then the app is reaching AICafe, but the provider account / subscription is blocked or quota-limited.

### CORS errors in browser

Make sure `FRONTEND_ORIGINS` in `backend/.env` includes the exact frontend origin, for example:

```env
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Then recreate the backend container so the updated env file is loaded.

### Reset / verify links point to wrong port

- Update `APP_URL` in `backend/.env`
- Recreate backend container

### Podman env changes are not taking effect

Updating `backend/.env` is not enough for an existing container.
You must recreate the backend container:

```powershell
podman rm -f ai-ticket-backend
podman run -d --name ai-ticket-backend --network ai-ticket-net -p 8080:8080 --env-file backend/.env localhost/ai-ticket-backend:latest
```

## Security Notes

- Do not commit `backend/.env`
- Do not paste passwords, API keys, or secrets into tickets
- Use a strong random `JWT_SECRET`
- For production, replace SQLite with a managed database and use stronger deployment controls

## Current Limitations

- SQLite is fine for local/demo usage but not ideal for serious multi-user production workloads
- Email uses SMTP configuration and depends on valid provider credentials
- AI routing depends entirely on upstream AICafe availability and quota state

## Suggested Next Improvements

- move from SQLite to PostgreSQL for production
- add formal automated tests for backend routes and frontend flows
- add CI/CD build validation
- add observability/logging for AI latency and failures
- add role-restricted admin authentication hardening

## Project Presentation Deck

A branded, animated PowerPoint deck is generated from `create_project_ppt.py`.

```powershell
cd c:\Users\thilak.l\ai-ticket-agent
python create_project_ppt.py
```

Output: `AI-Ticket-Agent-Project-Deck.pptx`.

The deck contains 11 slides — Title, Executive Summary, Architecture, AI Decision Flow, Features, Benefits, APIs, Security, Tech Stack, Roadmap, and Thanks — each with staggered fade-in entrance animations, emoji icon chips, rounded panels, and the dark purple/blue background extracted to `ppt_media_dump/image1.jpeg`. Requires `python-pptx` and `lxml`:

```powershell
python -m pip install python-pptx lxml
```
