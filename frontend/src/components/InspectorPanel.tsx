import { useState } from "react";
import { useAgentStore } from "@/lib/store";
import { useAgentRun } from "@/lib/agui/useAgentRun";
import { Button } from "@/components/ui/button";

type Tab = "state" | "events" | "tools";

export function InspectorPanel() {
  const [tab, setTab] = useState<Tab>("state");
  return (
    <aside className="w-[360px] shrink-0 border-l border-border/70 bg-surface-1 h-full flex flex-col">
      <div className="flex items-center gap-1 border-b border-border/70 px-2 py-1.5">
        {(["state", "events", "tools"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 text-xs rounded-md capitalize transition ${
              tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-xs">
        {tab === "state" && <StateTab />}
        {tab === "events" && <EventsTab />}
        {tab === "tools" && <ToolsTab />}
      </div>
    </aside>
  );
}

function StateTab() {
  const sharedState = useAgentStore((s) => s.sharedState);
  const setSharedState = useAgentStore((s) => s.setSharedState);
  const { sendStateDelta } = useAgentRun();
  const [draft, setDraft] = useState(JSON.stringify(sharedState, null, 2));
  const [err, setErr] = useState<string | null>(null);

  // Reset draft if external state changes
  const sig = JSON.stringify(sharedState);
  if (sig !== JSON.stringify(safeParse(draft) ?? {}) && err === null) {
    // Only reset when not editing (no parse error)
    // (intentionally lightweight; full sync omitted)
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shared state</div>
      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setErr(null); }}
        className="mono w-full h-72 bg-surface-2 rounded-md p-2 outline-none border border-border/70 focus:border-primary/40"
        spellCheck={false}
      />
      {err && <div className="text-destructive text-[10px]">{err}</div>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setDraft(JSON.stringify(sharedState, null, 2))}>
          Reset
        </Button>
        <Button size="sm" onClick={() => {
          const parsed = safeParse(draft);
          if (parsed === undefined) { setErr("Invalid JSON"); return; }
          const next = parsed as Record<string, unknown>;
          setSharedState(next);
          // Naive replace patch (server can apply); a real diff would be nicer.
          sendStateDelta([{ op: "replace", path: "", value: next }]);
        }}>
          Apply & sync
        </Button>
      </div>
    </div>
  );
}

function safeParse(s: string): unknown | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}

function EventsTab() {
  const log = useAgentStore((s) => s.eventLog);
  const clear = useAgentStore((s) => s.clearEventLog);
  const [filter, setFilter] = useState<string>("");
  const filtered = log.filter((e) => filter === "" || e.ev.type.includes(filter.toUpperCase()));
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter type…"
          className="flex-1 bg-surface-2 rounded-md px-2 py-1 outline-none border border-border/70 focus:border-primary/40"
        />
        <Button size="sm" variant="secondary" onClick={clear}>Clear</Button>
      </div>
      <div className="space-y-1">
        {filtered.slice().reverse().map((e, i) => (
          <details key={i} className="bg-surface-2 rounded-md border border-border/70">
            <summary className="cursor-pointer px-2 py-1 flex items-center gap-2">
              <span className="text-muted-foreground text-[10px] mono">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="font-mono text-[10px]">{e.ev.type}</span>
            </summary>
            <pre className="mono text-[10px] p-2 overflow-auto max-h-48 whitespace-pre-wrap break-words">
              {JSON.stringify(e.ev, null, 2)}
            </pre>
          </details>
        ))}
        {filtered.length === 0 && <div className="text-muted-foreground text-center py-6">No events.</div>}
      </div>
    </div>
  );
}

function ToolsTab() {
  const tools = useAgentStore((s) => s.toolCalls);
  const list = Object.values(tools);
  if (list.length === 0) return <div className="text-muted-foreground text-center py-6">No tool calls in this run.</div>;
  return (
    <div className="space-y-2">
      {list.map((tc) => (
        <div key={tc.id} className="bg-surface-2 rounded-md border border-border/70 p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px]">{tc.name}</span>
            <span className={`text-[10px] ${tc.status === "error" ? "text-destructive" : tc.status === "done" ? "text-status-done" : "text-primary"}`}>
              {tc.status}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {tc.endedAt ? `${tc.endedAt - tc.startedAt}ms` : "running…"}
          </div>
        </div>
      ))}
    </div>
  );
}
