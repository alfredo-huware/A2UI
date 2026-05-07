# A2UI

An AG-UI agent that streams generative UI to a React webapp. The backend wraps a Google ADK agent (`agent/`) and exposes it over the [AG-UI protocol](https://github.com/ag-ui/ag-ui) via a FastAPI bridge (`main.py`). The frontend (`webapp/`) consumes the SSE event stream with `@ag-ui/client`.

## Architecture

```
webapp (Vite, :8080)  ──HTTP/SSE──▶  main.py (FastAPI, :8000)  ──ADK runner──▶  agent/agent.py
                          AG-UI                                                    │
                                                                                   ▼
                                                                            Vertex AI / Gemini
```

Two services must be running:

1. **Backend** — `python main.py` on `:8000`, exposing `POST /agent` (AG-UI SSE).
2. **Frontend** — `vite` on `:8080`, configured to call `http://localhost:8000/agent`.

> Do **not** run `adk web` for this project. That serves the ADK dev UI on `:8080`, which (a) collides with the webapp's port and (b) speaks ADK's own protocol — not AG-UI — so the webapp can't talk to it.

## Prerequisites

- Python 3.13
- Node 18+ (or Bun) for the webapp
- Google Cloud project with Vertex AI enabled, plus `gcloud auth application-default login` already run

## One-time setup

### 1. Python virtual env

From the repo root:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r agent/requirements.txt
pip install fastapi uvicorn python-dotenv
```

### 2. Environment variables

Create `.env` at the repo root:

```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
```

`main.py` loads this via `python-dotenv` at startup.

### 3. Webapp deps

```bash
cd webapp
npm install   # or: bun install
```

## Running locally

You need **two terminals** (or background one of them).

### Terminal 1 — backend

From the repo root:

```bash
source .venv/bin/activate
python main.py
```

Expected output:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

The port is overridable: `PORT=8001 python main.py`.

### Terminal 2 — webapp

```bash
cd webapp
npm run dev   # or: bun dev
```

Vite serves the app at `http://localhost:8080`. Open it in your browser.

> If `:8080` is taken, vite falls back to `:8081`, `:8082`, etc. — check the terminal output. Free `:8080` (commonly held by `adk web` from a stale run) for the canonical setup.

### Pointing the webapp at a non-default backend

The webapp reads the agent URL from `VITE_AGENT_URL` (default `http://localhost:8000/agent`). Either:

- Create `webapp/.env.local` with `VITE_AGENT_URL=http://localhost:8001/agent`, or
- Override at runtime in the in-app Settings panel (the value is persisted to `localStorage` under `agui.settings.v1`).

## Verifying it works

With both services running, send a message in the webapp. You should see streamed tokens appear and (when the agent calls A2UI tools) generative UI render in the surface panel.

To smoke-test the backend without the webapp:

```bash
curl -N -X POST http://localhost:8000/agent \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t1","messages":[{"id":"m1","role":"user","content":"hi"}]}'
```

You should see SSE events (`RUN_STARTED`, `TEXT_MESSAGE_*`, `RUN_FINISHED`).

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Webapp shows "error" on send, network tab shows `ERR_CONNECTION_REFUSED` to `:8000` | Backend not running | Start `python main.py` |
| Webapp loads on `:8081` instead of `:8080` | Another process holds `:8080` (often `adk web`) | `lsof -nP -iTCP:8080 -sTCP:LISTEN` then kill it |
| Backend errors with `DefaultCredentialsError` | No GCP auth | `gcloud auth application-default login` |
| Backend errors mentioning `vertexai` permissions | Vertex AI API not enabled or wrong project | Enable Vertex AI in the project set in `.env` |
| Tokens arrive but no UI renders | A2UI custom event not firing | Check backend log for `Error parsing A2UI data` |

## Project layout

- `main.py` — FastAPI server; ADK ↔ AG-UI translation lives here
- `agent/agent.py` — root ADK agent definition
- `agent/utils/a2ui.py` — A2UI callback that wraps generative-UI JSON
- `webapp/src/lib/agui/useAgentRun.ts` — `HttpAgent` wiring on the frontend
- `webapp/src/lib/store.ts` — Zustand store consuming AG-UI events
