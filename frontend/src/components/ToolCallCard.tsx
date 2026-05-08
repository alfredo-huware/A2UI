import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAgentStore } from "@/lib/store";

export function ToolCallCard({ toolCallId }: { toolCallId: string }) {
  const tc = useAgentStore((s) => s.toolCalls[toolCallId]);
  const [open, setOpen] = useState(true);
  if (!tc) return null;

  const Icon = tc.status === "running" ? Loader2 : tc.status === "error" ? AlertTriangle : CheckCircle2;
  const iconCls = tc.status === "running" ? "animate-spin text-primary" : tc.status === "error" ? "text-destructive" : "text-status-done";
  const args = tc.argsParsed ? JSON.stringify(tc.argsParsed, null, 2) : tc.argsRaw || "";

  return (
    <div className="panel overflow-hidden animate-fade-in">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-xs">{tc.name}</span>
        <Icon className={`h-3.5 w-3.5 ml-auto ${iconCls}`} />
      </button>
      {open && (
        <div className="border-t border-border/70 p-3 space-y-2">
          {args && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Arguments</div>
              <pre className="mono text-xs bg-surface-2 rounded-md p-2 overflow-auto max-h-56 whitespace-pre-wrap break-words">{args}</pre>
            </div>
          )}
          {tc.result !== undefined && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Result</div>
              <pre className="mono text-xs bg-surface-2 rounded-md p-2 overflow-auto max-h-72 whitespace-pre-wrap break-words">
                {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}
              </pre>
            </div>
          )}
          {tc.endedAt && (
            <div className="text-[10px] text-muted-foreground">{tc.endedAt - tc.startedAt}ms</div>
          )}
        </div>
      )}
    </div>
  );
}
