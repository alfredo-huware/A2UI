import { useAgentStore, type Turn } from "@/lib/store";
import { ToolCallCard } from "./ToolCallCard";
import { A2UIRenderer } from "@/lib/a2ui/A2UIRenderer";
import { useAgentRun } from "@/lib/agui/useAgentRun";

export function MessageList({ turns }: { turns: Turn[] }) {
  return (
    <div className="space-y-6">
      {turns.map((turn) => (
        <div key={turn.id} className="animate-fade-in">
          {turn.role === "user" ? <UserBubble turn={turn} /> : <AssistantTurn turn={turn} />}
        </div>
      ))}
    </div>
  );
}

function UserBubble({ turn }: { turn: Turn }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm whitespace-pre-wrap">
        {turn.content}
      </div>
    </div>
  );
}

function AssistantTurn({ turn }: { turn: Turn }) {
  const { sendA2UIAction } = useAgentRun();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary/40 grid place-items-center text-[10px] font-semibold text-primary-foreground">A</div>
        <div className="text-xs font-medium text-muted-foreground">Agent</div>
      </div>
      <div className="pl-8 space-y-3">
        {turn.parts?.map((part, i) => {
          if (part.kind === "text") {
            return (
              <p key={`t-${i}`} className={`text-[15px] leading-relaxed text-foreground whitespace-pre-wrap ${part.streaming ? "caret" : ""}`}>
                {part.content}
              </p>
            );
          }
          if (part.kind === "tool") {
            return <ToolCallCard key={part.toolCallId} toolCallId={part.toolCallId} />;
          }
          if (part.kind === "a2ui") {
            return (
              <A2UIRenderer
                key={part.surfaceId}
                tree={part.tree}
                onAction={(action) => {
                  void sendA2UIAction(action.componentId, action.event, action.value ?? action.state, action.surfaceId);
                }}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
