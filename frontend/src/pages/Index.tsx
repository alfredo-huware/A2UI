import { useEffect, useRef, useState } from "react";
import { PanelRightOpen, PanelRightClose, Pencil } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MessageList } from "@/components/MessageList";
import { Composer } from "@/components/Composer";
import { InspectorPanel } from "@/components/InspectorPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/lib/store";
import { useAgentRun } from "@/lib/agui/useAgentRun";

const EXAMPLES = [
  "Summarize the latest in agent protocols",
  "Plan a 3-step research workflow",
  "Show me a form to configure output mode",
  "Walk through a tool call end-to-end",
];

const EMPTY_TURNS: any[] = [];

const Index = () => {
  const init = useAgentStore((s) => s.init);
  const threads = useAgentStore((s) => s.threads);
  const activeId = useAgentStore((s) => s.activeThreadId);
  const turns = useAgentStore((s) => s.turns[s.activeThreadId] ?? EMPTY_TURNS);
  const renameThread = useAgentStore((s) => s.renameThread);
  const activeThread = threads.find((t) => t.id === activeId);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { send } = useAgentRun();

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 flex items-center gap-3 border-b border-border/70 px-4">
          {editing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => { renameThread(activeId, titleDraft || "Untitled"); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
              className="bg-transparent outline-none border-b border-primary/40 text-sm font-medium px-1"
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(activeThread?.title ?? ""); setEditing(true); }}
              className="group flex items-center gap-1.5 text-sm font-medium truncate max-w-[40ch]"
            >
              <span className="truncate">{activeThread?.title ?? "—"}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition" />
            </button>
          )}
          <StatusPill />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInspectorOpen((v) => !v)}
              className="gap-1.5"
            >
              {inspectorOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              <span className="text-xs">Inspector</span>
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[820px] px-6 py-8">
            {turns.length === 0 ? (
              <EmptyState onPick={(t) => void send(t)} />
            ) : (
              <MessageList turns={turns} />
            )}
          </div>
        </div>

        <Composer />
      </main>

      {inspectorOpen && <InspectorPanel />}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-6">
      <div className="space-y-2">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/30 grid place-items-center text-primary-foreground font-bold">A</div>
        <h1 className="text-2xl font-semibold tracking-tight">Talk to the agent</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Streaming over AG-UI · renders A2UI generative UI inline.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="panel text-left text-sm px-3 py-2.5 hover:border-primary/40 hover:bg-accent/30 transition"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Index;
