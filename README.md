# AI Ticket Agent

## Architecture

- `backend/`
  - FastAPI backend
  - `app/main.py` exposes `/chat` endpoint
  - `app/agents.py` contains Clarification and Classification agents
  - `backend/.env` stores `API_KEY`
  - `backend/pyproject.toml` and `backend/requirements.txt` define Python dependencies

- `frontend/`
  - Vite + React frontend
  - `src/App.jsx` provides a simple conversational UI

## Setup

1. Set your HCL AICafe API key in `backend/.env`:

   ```env
   API_KEY=YOUR_API_KEY
   ```

2. Install backend dependencies:

   ```powershell
   python -m pip install -r backend/requirements.txt
   ```

3. Install frontend dependencies:

   ```powershell
   Set-Location frontend
   npm install
   ```

4. Run the backend:

   ```powershell
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. Run the frontend:

   ```powershell
   cd frontend
   npm run dev
   ```

## Quick start scripts

- Backend: `backend\run.ps1`
- Frontend: `frontend\run.ps1`

Use these from PowerShell to run the services with the correct working directory.

## Notes

- The frontend is configured to call `http://localhost:8000/chat`.
- If package installation fails due to network issues, retry when the registry is reachable.
