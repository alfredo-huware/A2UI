// Re-export the official AG-UI event types from @ag-ui/client (which re-exports @ag-ui/core).
// This replaces the previous hand-rolled Zod schemas.
export type {
  AGUIEvent,
  BaseEvent,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  StepStartedEvent,
  StepFinishedEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  StateSnapshotEvent,
  StateDeltaEvent,
  CustomEvent,
} from "@ag-ui/client";
export { EventType } from "@ag-ui/client";
