import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/lib/store";
import { useAgentRun } from "@/lib/agui/useAgentRun";

export function Composer() {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const status = useAgentStore((s) => s.status);
  const awaiting = useAgentStore((s) => s.awaitingUserInput);
  const { send, cancel } = useAgentRun();
  const running = status.kind !== "idle" && status.kind !== "done" && status.kind !== "error";
  const disabled = running || awaiting;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    void send(t);
  };

  return (
    <div className="border-t border-border/70 bg-background/80 backdrop-blur-sm">
      {awaiting && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/70 bg-muted/30">
          Agent is waiting for your response above.
        </div>
      )}
      <div className="mx-auto max-w-[820px] p-4">
        <div className="panel flex items-end gap-2 p-2">
          <Button variant="ghost" size="icon" className="shrink-0" disabled>
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={awaiting ? "Respond using the form above…" : "Message the agent…  (Enter to send · Shift+Enter for newline)"}
            rows={1}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-6 px-1 py-2 max-h-[200px] disabled:opacity-50"
          />
          {running ? (
            <Button onClick={cancel} variant="destructive" size="icon" className="shrink-0">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!text.trim() || disabled} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          AG-UI streaming · A2UI generative UI
        </div>
      </div>
    </div>
  );
}
