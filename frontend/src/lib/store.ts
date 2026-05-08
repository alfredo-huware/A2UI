import { create } from "zustand";
import * as jsonpatch from "fast-json-patch";
import type { AGUIEvent } from "@ag-ui/client";
import type { A2UITree } from "@/lib/a2ui/types";

export type RunStatus =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "step"; name: string }
  | { kind: "tool"; name: string }
  | { kind: "error"; message: string }
  | { kind: "done" };

export interface ToolCall {
  id: string;
  name: string;
  argsRaw: string;
  argsParsed?: unknown;
  status: "running" | "done" | "error";
  result?: unknown;
  isError?: boolean;
  startedAt: number;
  endedAt?: number;
}

export type AssistantPart =
  | { kind: "text"; messageId: string; content: string; streaming: boolean }
  | { kind: "tool"; toolCallId: string }
  | { kind: "a2ui"; surfaceId: string; tree: A2UITree };

export interface Turn {
  id: string;
  role: "user" | "assistant";
  /** for user: plain text content. for assistant: ordered parts. */
  content?: string;
  parts?: AssistantPart[];
  createdAt: number;
}

export interface ThreadMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface EventLogEntry {
  ts: number;
  ev: AGUIEvent;
}

interface AgentState {
  threads: ThreadMeta[];
  activeThreadId: string;
  turns: Record<string, Turn[]>; // by threadId
  toolCalls: Record<string, ToolCall>; // by toolCallId, current run
  status: RunStatus;
  sharedState: Record<string, unknown>;
  eventLog: EventLogEntry[];
  awaitingUserInput: boolean;

  // actions
  init: () => void;
  newThread: () => string;
  setActiveThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  deleteThread: (id: string) => void;
  appendUserTurn: (text: string) => string;
  applyEvent: (ev: AGUIEvent) => void;
  setStatus: (s: RunStatus) => void;
  resetRun: () => void;
  setSharedState: (s: Record<string, unknown>) => void;
  setAwaiting: (b: boolean) => void;
  clearEventLog: () => void;
}

const STORAGE_KEY = "agui.threads.v1";

function persistThreads(threads: ThreadMeta[], turns: Record<string, Turn[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads, turns }));
  } catch { /* ignore */ }
}

function loadThreads(): { threads: ThreadMeta[]; turns: Record<string, Turn[]> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { threads: [], turns: {} };
    return JSON.parse(raw);
  } catch { return { threads: [], turns: {} }; }
}

function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const SESSION_TITLE_RE = /^Sessione (\d+)$/;

function nextSessionTitle(threads: ThreadMeta[]): string {
  let max = 0;
  for (const t of threads) {
    const m = SESSION_TITLE_RE.exec(t.title);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `Sessione ${max + 1}`;
}

function ensureAssistantTurn(turns: Turn[]): Turn {
  const last = turns[turns.length - 1];
  if (last && last.role === "assistant") return last;
  const t: Turn = { id: makeId("t"), role: "assistant", parts: [], createdAt: Date.now() };
  turns.push(t);
  return t;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  threads: [],
  activeThreadId: "",
  turns: {},
  toolCalls: {},
  status: { kind: "idle" },
  sharedState: {},
  eventLog: [],
  awaitingUserInput: false,

  init: () => {
    const { threads, turns } = loadThreads();
    if (threads.length === 0) {
      const id = makeId("thr");
      const t: ThreadMeta = { id, title: nextSessionTitle([]), updatedAt: Date.now() };
      set({ threads: [t], activeThreadId: id, turns: { [id]: [] } });
      persistThreads([t], { [id]: [] });
    } else {
      set({ threads, activeThreadId: threads[0].id, turns });
    }
  },

  newThread: () => {
    const id = makeId("thr");
    const existing = get().threads;
    const t: ThreadMeta = { id, title: nextSessionTitle(existing), updatedAt: Date.now() };
    const threads = [t, ...existing];
    const turns = { ...get().turns, [id]: [] };
    set({ threads, activeThreadId: id, turns, status: { kind: "idle" }, toolCalls: {}, sharedState: {}, eventLog: [] });
    persistThreads(threads, turns);
    return id;
  },

  setActiveThread: (id) => {
    set({ activeThreadId: id, status: { kind: "idle" }, toolCalls: {}, sharedState: {}, eventLog: [], awaitingUserInput: false });
  },

  renameThread: (id, title) => {
    const threads = get().threads.map((t) => (t.id === id ? { ...t, title, updatedAt: Date.now() } : t));
    set({ threads });
    persistThreads(threads, get().turns);
  },

  deleteThread: (id) => {
    const threads = get().threads.filter((t) => t.id !== id);
    const turns = { ...get().turns };
    delete turns[id];
    let activeThreadId = get().activeThreadId;
    if (activeThreadId === id) activeThreadId = threads[0]?.id ?? "";
    set({ threads, turns, activeThreadId });
    persistThreads(threads, turns);
    if (!activeThreadId) get().newThread();
  },

  appendUserTurn: (text) => {
    const tid = get().activeThreadId;
    const turn: Turn = { id: makeId("u"), role: "user", content: text, createdAt: Date.now() };
    const turns = { ...get().turns, [tid]: [...(get().turns[tid] ?? []), turn] };
    const threads = get().threads.map((t) =>
      t.id === tid ? { ...t, updatedAt: Date.now() } : t,
    );
    set({ turns, threads });
    persistThreads(threads, turns);
    return turn.id;
  },

  setStatus: (s) => set({ status: s }),
  setAwaiting: (b) => set({ awaitingUserInput: b }),
  setSharedState: (s) => set({ sharedState: s }),
  resetRun: () => set({ toolCalls: {}, status: { kind: "idle" }, awaitingUserInput: false }),
  clearEventLog: () => set({ eventLog: [] }),

  applyEvent: (ev) => {
    // log every event
    const eventLog = [...get().eventLog, { ts: Date.now(), ev }].slice(-500);
    const tid = get().activeThreadId;
    const turns = { ...get().turns };
    const threadTurns = [...(turns[tid] ?? [])];
    const toolCalls = { ...get().toolCalls };
    let status = get().status;
    let sharedState = get().sharedState;
    let awaitingUserInput = get().awaitingUserInput;

    switch (ev.type) {
      case "RUN_STARTED":
        status = { kind: "thinking" };
        break;
      case "RUN_FINISHED":
        status = { kind: "done" };
        break;
      case "RUN_ERROR":
        status = { kind: "error", message: ev.message ?? "Run error" };
        break;
      case "STEP_STARTED":
        status = { kind: "step", name: ev.stepName ?? "step" };
        break;
      case "STEP_FINISHED":
        if (status.kind === "step") status = { kind: "thinking" };
        break;

      case "TEXT_MESSAGE_START": {
        const turn = ensureAssistantTurn(threadTurns);
        turn.parts = turn.parts ?? [];
        turn.parts.push({ kind: "text", messageId: ev.messageId, content: "", streaming: true });
        break;
      }
      case "TEXT_MESSAGE_CONTENT": {
        const turn = ensureAssistantTurn(threadTurns);
        const part = turn.parts?.find((p) => p.kind === "text" && p.messageId === ev.messageId) as
          | (AssistantPart & { kind: "text" }) | undefined;
        if (part) part.content += ev.delta;
        else turn.parts?.push({ kind: "text", messageId: ev.messageId, content: ev.delta, streaming: true });
        break;
      }
      case "TEXT_MESSAGE_END": {
        const turn = ensureAssistantTurn(threadTurns);
        const part = turn.parts?.find((p) => p.kind === "text" && p.messageId === ev.messageId) as
          | (AssistantPart & { kind: "text" }) | undefined;
        if (part) part.streaming = false;
        break;
      }

      case "TOOL_CALL_START": {
        toolCalls[ev.toolCallId] = {
          id: ev.toolCallId,
          name: ev.toolCallName,
          argsRaw: "",
          status: "running",
          startedAt: Date.now(),
        };
        const turn = ensureAssistantTurn(threadTurns);
        turn.parts?.push({ kind: "tool", toolCallId: ev.toolCallId });
        status = { kind: "tool", name: ev.toolCallName };
        break;
      }
      case "TOOL_CALL_ARGS": {
        const tc = toolCalls[ev.toolCallId];
        if (tc) {
          tc.argsRaw += ev.delta;
          try { tc.argsParsed = JSON.parse(tc.argsRaw); } catch { /* still streaming */ }
        }
        break;
      }
      case "TOOL_CALL_END": {
        const tc = toolCalls[ev.toolCallId];
        if (tc && tc.status === "running") tc.status = "done";
        if (status.kind === "tool") status = { kind: "thinking" };
        break;
      }
      case "TOOL_CALL_RESULT": {
        const tc = toolCalls[ev.toolCallId];
        if (tc) {
          tc.result = ev.content;
          tc.status = "done";
          tc.endedAt = Date.now();
        }
        break;
      }

      case "STATE_SNAPSHOT":
        sharedState = (ev.snapshot && typeof ev.snapshot === "object")
          ? { ...(ev.snapshot as Record<string, unknown>) }
          : {};
        break;
      case "STATE_DELTA": {
        try {
          const next = jsonpatch.applyPatch(
            jsonpatch.deepClone(sharedState),
            ev.delta as jsonpatch.Operation[],
            /*validate*/ false,
            /*mutateDocument*/ true,
          ).newDocument as Record<string, unknown>;
          sharedState = next;
        } catch (e) {
          console.warn("[AG-UI] STATE_DELTA failed to apply", e);
        }
        break;
      }

      case "CUSTOM": {
        if (ev.name === "a2ui" && ev.value && typeof ev.value === "object") {
          const payload = ev.value as any;
          const turn = ensureAssistantTurn(threadTurns);
          turn.parts = turn.parts ?? [];

          // Determine surfaceId from any of the standard A2UI keys
          const surfaceId = 
            payload.beginRendering?.surfaceId ?? 
            payload.surfaceUpdate?.surfaceId ?? 
            payload.dataModelUpdate?.surfaceId ?? 
            payload.deleteSurface?.surfaceId ?? 
            `a2ui_gen_${Math.random().toString(36).slice(2, 8)}`;

          if (payload.deleteSurface) {
            turn.parts = turn.parts.filter(p => !(p.kind === "a2ui" && p.surfaceId === surfaceId));
            break;
          }

          let part = turn.parts.find((p) => p.kind === "a2ui" && p.surfaceId === surfaceId) as
            | (AssistantPart & { kind: "a2ui" }) | undefined;

          if (!part) {
            part = { 
              kind: "a2ui", 
              surfaceId, 
              tree: { root: "", components: [], state: {} } 
            };
            turn.parts.push(part);
          }

          const tree = part.tree;

          if (payload.beginRendering) {
            tree.root = payload.beginRendering.root;
            if (payload.beginRendering.version) tree.version = payload.beginRendering.version;
          }

          if (payload.surfaceUpdate) {
            if (payload.surfaceUpdate.root) tree.root = payload.surfaceUpdate.root;
            if (payload.surfaceUpdate.components) {
              const newComps = payload.surfaceUpdate.components as A2UIComponent[];
              const existingMap = new Map(tree.components.map(c => [c.id, c]));
              for (const nc of newComps) {
                existingMap.set(nc.id, nc);
              }
              tree.components = Array.from(existingMap.values());
            }
          }

          if (payload.dataModelUpdate) {
            if (payload.dataModelUpdate.state) {
              tree.state = { ...(tree.state ?? {}), ...payload.dataModelUpdate.state };
            }
          }

          // If the tree contains a Form/Button at root, treat as awaiting input.
          const root = tree.components.find((c) => c.id === tree.root);
          if (root && (root.type === "Form" || root.type === "Button")) awaitingUserInput = true;
        } else {
          console.info("[AG-UI] custom event:", ev.name, ev.value);
        }
        break;
      }
    }

    turns[tid] = threadTurns;
    set({ turns, toolCalls, status, sharedState, eventLog, awaitingUserInput });
    persistThreads(get().threads, turns);
  },
}));
