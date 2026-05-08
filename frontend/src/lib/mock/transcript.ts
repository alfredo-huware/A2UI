import type { AGUIEvent } from "@ag-ui/client";

/**
 * A pre-recorded AG-UI transcript exercising:
 *  - streamed text
 *  - one tool call with streamed args + result
 *  - one A2UI form
 *  - one state delta
 *  - lifecycle events
 *
 * Field names follow the official AG-UI spec (toolCallName, snapshot, delta, value, etc.)
 */
export const MOCK_TRANSCRIPT: Array<[number, AGUIEvent]> = [
  [0,   { type: "RUN_STARTED", threadId: "mock", runId: "mock-run-1" }],
  [200, { type: "STATE_SNAPSHOT", snapshot: { user: { name: "guest" }, plan: [] } }],
  [200, { type: "STEP_STARTED", stepName: "reasoning" }],

  [150, { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" }],
  ...streamText("m1", "Got it. Let me think about this and pull a quick reference.\n\n", 28),
  [200, { type: "TEXT_MESSAGE_END", messageId: "m1" }],

  [150, { type: "STEP_FINISHED", stepName: "reasoning" }],
  [100, { type: "STEP_STARTED", stepName: "tool" }],

  [120, { type: "TOOL_CALL_START", toolCallId: "tc1", toolCallName: "search_web" }],
  ...streamArgs("tc1", '{"query":"AG-UI protocol overview","limit":3}', 12),
  [180, { type: "TOOL_CALL_END", toolCallId: "tc1" }],
  [320, { type: "TOOL_CALL_RESULT", messageId: "m-res-1", toolCallId: "tc1", content: JSON.stringify({
    results: [
      { title: "AG-UI Protocol", url: "https://docs.ag-ui.com", snippet: "Open standard for agent ↔ UI streaming." },
      { title: "A2UI v0.9", url: "https://a2ui.dev", snippet: "Declarative generative UI for agents." },
    ],
  }) }],

  [200, { type: "STEP_FINISHED", stepName: "tool" }],
  [120, { type: "STATE_DELTA", delta: [
    { op: "add", path: "/plan/-", value: "Searched references" },
    { op: "replace", path: "/user/name", value: "you" },
  ] }],

  [180, { type: "TEXT_MESSAGE_START", messageId: "m2", role: "assistant" }],
  ...streamText("m2", "Here's a quick form to confirm what you want next:", 22),
  [150, { type: "TEXT_MESSAGE_END", messageId: "m2" }],

  [200, { type: "CUSTOM", name: "a2ui", value: {
    version: "0.9",
    surfaceId: "confirm_next",
    root: "form1",
    state: { mode: "summary", includeSources: true, note: "" },
    components: [
      { id: "form1", type: "Form", props: { submitLabel: "Continue" }, children: ["card1"] },
      { id: "card1", type: "Card", props: { title: "What should I do next?" }, children: ["mode", "sources", "note"] },
      { id: "mode", type: "RadioGroup", props: {
        label: "Output mode",
        options: [
          { label: "Short summary", value: "summary" },
          { label: "Detailed report", value: "report" },
          { label: "Bullet outline", value: "outline" },
        ],
      }, bindings: [{ prop: "value", source: "$state.mode" }] },
      { id: "sources", type: "Checkbox", props: { label: "Include sources" },
        bindings: [{ prop: "checked", source: "$state.includeSources" }] },
      { id: "note", type: "Input", props: { label: "Optional note", placeholder: "Anything to add?" },
        bindings: [{ prop: "value", source: "$state.note" }] },
    ],
  } }],

  [200, { type: "RUN_FINISHED", threadId: "mock", runId: "mock-run-1" }],
];

function streamText(messageId: string, text: string, chunkSize = 20): Array<[number, AGUIEvent]> {
  const out: Array<[number, AGUIEvent]> = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    out.push([35, { type: "TEXT_MESSAGE_CONTENT", messageId, delta: text.slice(i, i + chunkSize) }]);
  }
  return out;
}

function streamArgs(toolCallId: string, json: string, chunkSize = 8): Array<[number, AGUIEvent]> {
  const out: Array<[number, AGUIEvent]> = [];
  for (let i = 0; i < json.length; i += chunkSize) {
    out.push([45, { type: "TOOL_CALL_ARGS", toolCallId, delta: json.slice(i, i + chunkSize) }]);
  }
  return out;
}

export async function runMockTranscript(
  onEvent: (ev: AGUIEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (const [delay, ev] of MOCK_TRANSCRIPT) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, delay));
    if (signal?.aborted) return;
    onEvent(ev);
  }
}
