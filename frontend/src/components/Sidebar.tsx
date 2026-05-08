import { useMemo } from "react";
import { Plus, MessageSquare, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { useAgentStore, type ThreadMeta, type Turn } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onOpenSettings: () => void;
}

type Bucket = "Today" | "Yesterday" | "Previous 7 days" | "Older";

const BUCKET_ORDER: Bucket[] = ["Today", "Yesterday", "Previous 7 days", "Older"];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bucketFor(ts: number, now: number): Bucket {
  const today = startOfDay(now);
  const dayMs = 86_400_000;
  const tsDay = startOfDay(ts);
  if (tsDay === today) return "Today";
  if (tsDay === today - dayMs) return "Yesterday";
  if (tsDay >= today - 6 * dayMs) return "Previous 7 days";
  return "Older";
}

function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function previewFromTurn(turn: Turn | undefined): string {
  if (!turn) return "";
  if (turn.role === "user") return turn.content ?? "";
  const text = turn.parts
    ?.map((p) => {
      if (p.kind === "text") return p.content;
      if (p.kind === "tool") return "";
      if (p.kind === "a2ui") return "";
      return "";
    })
    .join(" ")
    .trim();
  if (text) return text;
  // Fall back to a hint if assistant turn had no text parts (only tools / UI)
  const hasTool = turn.parts?.some((p) => p.kind === "tool");
  const hasA2ui = turn.parts?.some((p) => p.kind === "a2ui");
  if (hasA2ui) return "Rendered UI";
  if (hasTool) return "Tool call";
  return "";
}

export function Sidebar({ onOpenSettings }: Props) {
  const threads = useAgentStore((s) => s.threads);
  const activeId = useAgentStore((s) => s.activeThreadId);
  const turnsByThread = useAgentStore((s) => s.turns);
  const setActive = useAgentStore((s) => s.setActiveThread);
  const newThread = useAgentStore((s) => s.newThread);
  const del = useAgentStore((s) => s.deleteThread);

  const groups = useMemo(() => {
    const now = Date.now();
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    const out: Record<Bucket, ThreadMeta[]> = {
      "Today": [],
      "Yesterday": [],
      "Previous 7 days": [],
      "Older": [],
    };
    for (const t of sorted) out[bucketFor(t.updatedAt, now)].push(t);
    return out;
  }, [threads]);

  const now = Date.now();

  return (
    <aside className="w-[280px] shrink-0 border-r border-border/70 bg-sidebar flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40 grid place-items-center text-[11px] font-bold text-primary-foreground">A</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-none">Agent</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">AG-UI · A2UI v0.9</div>
        </div>
      </div>

      <div className="p-3">
        <Button onClick={() => newThread()} className="w-full justify-start gap-2" size="sm">
          <Plus className="h-4 w-4" /> New conversation
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <div className="px-2 py-6 text-xs text-muted-foreground text-center">
            No conversations yet.
          </div>
        ) : (
          BUCKET_ORDER.map((bucket) => {
            const items = groups[bucket];
            if (!items.length) return null;
            return (
              <div key={bucket} className="mb-3">
                <div className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {bucket}
                </div>
                <div className="space-y-0.5">
                  {items.map((t) => {
                    const turns = turnsByThread[t.id] ?? [];
                    const last = turns[turns.length - 1];
                    const preview = previewFromTurn(last);
                    const active = activeId === t.id;
                    return (
                      <div key={t.id} className="group relative">
                        <button
                          onClick={() => setActive(t.id)}
                          className={cn(
                            "w-full flex items-start gap-2 px-2.5 py-2 rounded-md text-left hover:bg-sidebar-accent transition-colors min-w-0",
                            active && "bg-sidebar-accent text-sidebar-accent-foreground",
                          )}
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate flex-1 text-sm leading-tight">{t.title}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums group-hover:opacity-0 transition-opacity">
                                {relativeTime(t.updatedAt, now)}
                              </span>
                            </div>
                            {preview && (
                              <div className="truncate text-[11px] text-muted-foreground mt-0.5 pr-8">
                                {preview}
                              </div>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); del(t.id); }}
                          className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-background/60 transition"
                          aria-label="Delete thread"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <SettingsIcon className="h-3.5 w-3.5" /> Settings
        </button>
      </div>
    </aside>
  );
}
