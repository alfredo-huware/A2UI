import { useCallback } from "react";
import { HttpAgent } from "@ag-ui/client";
import type { AGUIEvent } from "@ag-ui/client";
import type { Message } from "@ag-ui/client";
import { useAgentStore } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { runMockTranscript } from "@/lib/mock/transcript";

// Module-level map so all hook instances share the same agents.
// Keyed by "agentUrl::threadId" so URL changes create fresh agents.
const agentInstances = new Map<string, HttpAgent>();

function getAgent(url: string, threadId: string): HttpAgent {
  const key = `${url}::${threadId}`;
  if (!agentInstances.has(key)) {
    agentInstances.set(key, new HttpAgent({ url, threadId }));
  }
  return agentInstances.get(key)!;
}

function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useAgentRun() {
  const { agentUrl, useMock } = useSettings();
  const applyEvent = useAgentStore((s) => s.applyEvent);
  const setStatus = useAgentStore((s) => s.setStatus);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);

  const send = useCallback(
    async (text: string) => {
      const tid = useAgentStore.getState().activeThreadId;
      useAgentStore.getState().appendUserTurn(text);
      setStatus({ kind: "thinking" });

      if (useMock) {
        const ac = new AbortController();
        try {
          await runMockTranscript((ev) => applyEvent(ev as AGUIEvent), ac.signal);
        } catch (e) {
          if (!ac.signal.aborted) setStatus({ kind: "error", message: String((e as Error)?.message ?? e) });
        }
        return;
      }

      const agent = getAgent(agentUrl, tid);
      const userMsg: Message = { id: makeId("msg"), role: "user", content: text };
      agent.addMessage(userMsg);

      try {
        await agent.runAgent({}, {
          onEvent({ event }) { applyEvent(event as AGUIEvent); },
          onRunFailed({ error }) { setStatus({ kind: "error", message: error.message }); },
        });
      } catch (e) {
        setStatus({ kind: "error", message: String((e as Error)?.message ?? e) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeThreadId, agentUrl, useMock],
  );

  const sendA2UIAction = useCallback(
    async (componentId: string, event: string, value: unknown, surfaceId?: string) => {
      const tid = useAgentStore.getState().activeThreadId;
      useAgentStore.getState().setAwaiting(false);

      if (useMock) return;

      const actionText =
        event === "submit"
          ? `I submitted the form ${componentId} with values: ${JSON.stringify(value)}`
          : `Action: ${event} on component ${componentId} with value: ${JSON.stringify(value)}`;

      const agent = getAgent(agentUrl, tid);
      const userMsg: Message = { id: makeId("msg"), role: "user", content: actionText };
      agent.addMessage(userMsg);
      setStatus({ kind: "thinking" });

      try {
        await agent.runAgent(
          { forwardedProps: { componentId, event, value, surfaceId } },
          {
            onEvent({ event: ev }) { applyEvent(ev as AGUIEvent); },
            onRunFailed({ error }) { setStatus({ kind: "error", message: error.message }); },
          },
        );
      } catch (e) {
        setStatus({ kind: "error", message: String((e as Error)?.message ?? e) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeThreadId, agentUrl, useMock],
  );

  const cancel = useCallback(() => {
    const tid = useAgentStore.getState().activeThreadId;
    const agent = agentInstances.get(`${agentUrl}::${tid}`);
    agent?.abortRun();
    setStatus({ kind: "idle" });
  }, [agentUrl, setStatus]);

  const sendStateDelta = useCallback(
    (patch: Array<{ op: string; path: string; value?: unknown }>) => {
      const tid = useAgentStore.getState().activeThreadId;
      if (useMock) return;
      void fetch(agentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: tid,
          messages: [],
          forwardedProps: { type: "STATE_PATCH", patch },
          runId: makeId("patch"),
          tools: [],
          context: [],
          state: null,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [agentUrl, useMock],
  );

  return { send, sendA2UIAction, sendStateDelta, cancel };
}
