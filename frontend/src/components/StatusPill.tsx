import { Loader2, AlertTriangle, Wrench, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { useAgentStore, type RunStatus } from "@/lib/store";

export function StatusPill() {
  const status = useAgentStore((s) => s.status);
  const { label, Icon, tone } = describe(status);
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function describe(s: RunStatus): { label: string; Icon: typeof Loader2; tone: string } {
  switch (s.kind) {
    case "idle":
      return { label: "Idle", Icon: Circle, tone: "border-border/70 text-muted-foreground bg-muted/30" };
    case "thinking":
      return { label: "Thinking", Icon: Sparkles, tone: "border-primary/40 text-primary bg-primary/10" };
    case "step":
      return { label: `Step: ${s.name}`, Icon: Loader2, tone: "border-primary/40 text-primary bg-primary/10" };
    case "tool":
      return { label: `Tool: ${s.name}`, Icon: Wrench, tone: "border-status-tool/40 text-status-tool bg-status-tool/10" };
    case "error":
      return { label: "Error", Icon: AlertTriangle, tone: "border-destructive/40 text-destructive bg-destructive/10" };
    case "done":
      return { label: "Done", Icon: CheckCircle2, tone: "border-status-done/40 text-status-done bg-status-done/10" };
  }
}
