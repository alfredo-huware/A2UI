# Agent — AG-UI + A2UI Console

A production-style React frontend that speaks two open protocols:

- **AG-UI** (Agent–User Interaction Protocol) — SSE-over-POST transport for streaming typed agent events.
- **A2UI v0.9** (Google's declarative Generative UI spec) — JSON component trees the agent emits inside `CUSTOM` events; rendered natively here.

## Quick start

```bash
bun install
bun run dev
```

By default the UI runs against an in-browser **mock transcript** so you can demo it without a backend. Open **Settings** (sidebar bottom) to toggle off "Use mock transcript" and point at a real backend.

## Pointing at a real backend

1. Set `VITE_AGENT_URL` in a `.env` file (default: `http://localhost:8000/agent`).
2. Or paste the URL into Settings.
3. Disable "Use mock transcript".

The UI POSTs `{ threadId, input, messages?, lastEventId? }` and expects a `text/event-stream` response of `data: <JSON-AGUIEvent>\n\n` frames. Reconnects with exponential backoff and resumes from the last event id.

## AG-UI events handled

| Category | Events |
| --- | --- |
| Lifecycle | `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED` |
| Text | `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END` |
| Tools | `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT` |
| State | `STATE_SNAPSHOT`, `STATE_DELTA` (RFC 6902 JSON Patch) |
| Custom | `CUSTOM` (with `name: "a2ui"` carrying an A2UI tree) |

Unknown event types are logged as warnings and ignored — they will never break the stream.

## A2UI rendering pipeline

`src/lib/a2ui/A2UIRenderer.tsx` consumes a tree:

```ts
{ version, root, components: [{ id, type, props, children?, bindings? }], state?, surfaceId? }
```

It walks from `root`, resolves `bindings` (`$state.path`) against per-tree state, and renders via the catalog in `src/lib/a2ui/catalog.tsx`. Missing children show skeletons so partial trees stream cleanly. User interactions are emitted as `A2UI_ACTION` user inputs back to the agent.

### Built-in components

`Card · Heading · Text · Image · Button · Input · Select · Checkbox · RadioGroup · Form · List · Stack · Row · Divider · Badge · Spinner`.

### Adding a component

Add a renderer entry to `A2UI_CATALOG` in `catalog.tsx`. Renderers receive `{ component, props, state, setState, emit, renderChild }`.

## Architecture

```
src/lib/agui/      AG-UI client (SSE), zod schemas, useAgentRun hook
src/lib/a2ui/      A2UI types, renderer, catalog, binding resolver
src/lib/mock/      Pre-recorded transcript replayer
src/lib/store.ts   zustand store: threads, turns, tool calls, status, shared state, event log
src/components/    Sidebar, MessageList, ToolCallCard, Composer, InspectorPanel, SettingsDialog, StatusPill
```

## Inspector

The right-side inspector (toggle in header) has three tabs:

- **State** — live JSON view of the shared state. Edit and click "Apply & sync" to push a `STATE_PATCH` user input back to the agent.
- **Events** — raw AG-UI event log with timestamps; filterable.
- **Tools** — tool calls in the current run with timing.

## Known gaps

- Tool args streamed as deltas are pretty-printed only once they parse as full JSON; partial JSON is shown raw.
- The State tab sends a single `replace` patch; it does not compute a true diff.
- A2UI catalog covers v0.9 essentials. Advanced components (charts, tables, maps) need to be added per project.
- localStorage-only persistence; no backend storage of threads.
- Multi-tab sync is not implemented.
