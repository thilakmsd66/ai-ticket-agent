# Frontend Notes

This frontend is part of the AI Ticket Agent application.

For full project documentation, setup, environment variables, Podman usage, testing flow, and troubleshooting, use the repository root guide:

- `../README.md`

Quick local commands:

```powershell
cd frontend
npm install
npm run dev
```

Quick container build:

```powershell
cd frontend
podman build --tls-verify=false --build-arg VITE_API_BASE_URL=http://localhost:8080 -t ai-ticket-frontend -f Containerfile .
```
