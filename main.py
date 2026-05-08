import os
import json
import uuid
import logging
from typing import AsyncGenerator
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types
from ag_ui.core import (
    EventType,
    RunStartedEvent, RunFinishedEvent, RunErrorEvent,
    TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent,
    ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent, ToolCallResultEvent,
    CustomEvent,
)
from ag_ui.encoder import EventEncoder
from agent.agent import root_agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = Runner(
    agent=root_agent,
    app_name="cloud_dashboard",
    session_service=InMemorySessionService(),
    auto_create_session=True,
)


def _make_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@app.post("/agent")
async def agent_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    thread_id = body.get("threadId", "default-thread")
    messages = body.get("messages", [])
    forwarded_props = body.get("forwardedProps") or {}

    # --- Route: STATE_PATCH (sent as forwardedProps from the inspector panel) ---
    state_delta = None
    if forwarded_props.get("type") == "STATE_PATCH":
        state_delta = forwarded_props.get("patch")

    # --- Route: extract the latest user message from the messages array ---
    new_message = None
    if not state_delta:
        for msg in reversed(messages):
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "user" and isinstance(content, str) and content:
                new_message = types.Content(role="user", parts=[types.Part(text=content)])
                break
            elif role == "user" and isinstance(content, list):
                # multimodal – extract text parts only for now
                text = " ".join(p.get("text", "") for p in content if p.get("type") == "text")
                if text:
                    new_message = types.Content(role="user", parts=[types.Part(text=text)])
                break

    encoder = EventEncoder()

    async def event_generator() -> AsyncGenerator[str, None]:
        run_id = _make_id("run")
        yield encoder.encode(RunStartedEvent(
            type=EventType.RUN_STARTED,
            thread_id=thread_id,
            run_id=run_id,
        ))

        A2UI_OPEN = "<a2ui-json>"
        A2UI_CLOSE = "</a2ui-json>"

        try:
            msg_id = _make_id("msg")
            text_open = False
            text_pending = ""        # buffered text waiting to be safely emitted (may end in a partial tag prefix)
            inside_a2ui_block = False  # currently between <a2ui-json> and </a2ui-json>
            bare_json_suppress = False  # model emitted JSON without the wrapper — suppress everything
            received_partial_text = False
            sent_tool_calls: set[str] = set()

            def _filter_chunk(chunk: str) -> str:
                """Strip <a2ui-json>...</a2ui-json> blocks from a streaming text chunk.

                Returns text safe to stream right now. Any tail that might be a
                split tag is held in `text_pending` until the next chunk.
                """
                nonlocal text_pending, inside_a2ui_block, bare_json_suppress
                text_pending += chunk
                output = ""
                while text_pending:
                    if inside_a2ui_block:
                        idx = text_pending.find(A2UI_CLOSE)
                        if idx >= 0:
                            text_pending = text_pending[idx + len(A2UI_CLOSE):]
                            inside_a2ui_block = False
                            continue
                        # Hold back any trailing partial close tag prefix
                        keep = 0
                        for i in range(min(len(text_pending), len(A2UI_CLOSE) - 1), 0, -1):
                            if text_pending.endswith(A2UI_CLOSE[:i]):
                                keep = i
                                break
                        text_pending = text_pending[-keep:] if keep else ""
                        return output
                    # Outside a block.
                    # If the model is emitting bare JSON (no wrapper) at the very
                    # start, the agent callback handles the final parse — drop
                    # the streamed text so it doesn't leak as raw JSON.
                    if not bare_json_suppress and not output and not text_open:
                        stripped = text_pending.lstrip()
                        if stripped and (stripped[0] in ("[", "{") or stripped.startswith("```")):
                            bare_json_suppress = True
                    if bare_json_suppress:
                        text_pending = ""
                        return output
                    idx = text_pending.find(A2UI_OPEN)
                    if idx >= 0:
                        output += text_pending[:idx]
                        text_pending = text_pending[idx + len(A2UI_OPEN):]
                        inside_a2ui_block = True
                        continue
                    # Hold back any trailing partial open tag prefix
                    keep = 0
                    for i in range(min(len(text_pending), len(A2UI_OPEN) - 1), 0, -1):
                        if text_pending.endswith(A2UI_OPEN[:i]):
                            keep = i
                            break
                    if keep:
                        output += text_pending[:-keep]
                        text_pending = text_pending[-keep:]
                    else:
                        output += text_pending
                        text_pending = ""
                    return output
                return output

            async for event in runner.run_async(
                user_id="local-user",
                session_id=thread_id,
                new_message=new_message,
                state_delta=state_delta,
                run_config=RunConfig(streaming_mode=StreamingMode.SSE),
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        # --- Streaming text ---
                        # Strip <a2ui-json>...</a2ui-json> blocks so the raw JSON
                        # never reaches the chat. Conversational text outside
                        # the tags streams through normally.
                        if part.text:
                            # SSE streaming emits partial deltas followed by a
                            # non-partial event with the full accumulated text.
                            # Skip the aggregated final to avoid duplication.
                            if event.partial:
                                received_partial_text = True
                            elif received_partial_text:
                                continue
                            safe_text = _filter_chunk(part.text)
                            if safe_text and not safe_text.isspace():
                                if not text_open:
                                    yield encoder.encode(TextMessageStartEvent(
                                        type=EventType.TEXT_MESSAGE_START,
                                        message_id=msg_id,
                                        role="assistant",
                                    ))
                                    text_open = True
                                yield encoder.encode(TextMessageContentEvent(
                                    type=EventType.TEXT_MESSAGE_CONTENT,
                                    message_id=msg_id,
                                    delta=safe_text,
                                ))

                        # --- A2UI inline data (produced by a2ui_callback) ---
                        if part.inline_data:
                            data = part.inline_data.data
                            if b"<a2a_datapart_json>" in data:
                                try:
                                    raw_json = data.split(b"<a2a_datapart_json>")[1].split(b"</a2a_datapart_json>")[0]
                                    parsed = json.loads(raw_json)
                                    if (
                                        parsed.get("kind") == "data"
                                        and parsed.get("metadata", {}).get("mimeType") == "application/json+a2ui"
                                    ):
                                        yield encoder.encode(CustomEvent(
                                            type=EventType.CUSTOM,
                                            name="a2ui",
                                            value=parsed.get("data"),
                                        ))
                                except Exception as e:
                                    logger.error(f"Error parsing A2UI data: {e}")

                # --- Tool calls ---
                fcs = event.get_function_calls()
                if fcs:
                    for fc in fcs:
                        call_id = getattr(fc, "id", None) or f"call_{fc.name}_{hash(str(fc.args))}"
                        if call_id in sent_tool_calls:
                            continue
                        sent_tool_calls.add(call_id)

                        yield encoder.encode(ToolCallStartEvent(
                            type=EventType.TOOL_CALL_START,
                            tool_call_id=call_id,
                            tool_call_name=fc.name,
                        ))
                        if fc.args:
                            yield encoder.encode(ToolCallArgsEvent(
                                type=EventType.TOOL_CALL_ARGS,
                                tool_call_id=call_id,
                                delta=json.dumps(fc.args),
                            ))
                        yield encoder.encode(ToolCallEndEvent(
                            type=EventType.TOOL_CALL_END,
                            tool_call_id=call_id,
                        ))

                # --- Tool results ---
                frs = event.get_function_responses()
                if frs:
                    for fr in frs:
                        call_id = getattr(fr, "id", None) or next(reversed(list(sent_tool_calls)), "call_1")
                        content = fr.response if isinstance(fr.response, str) else json.dumps(fr.response)
                        yield encoder.encode(ToolCallResultEvent(
                            type=EventType.TOOL_CALL_RESULT,
                            message_id=_make_id("msg"),
                            tool_call_id=call_id,
                            content=content,
                        ))

            if text_open:
                yield encoder.encode(TextMessageEndEvent(
                    type=EventType.TEXT_MESSAGE_END,
                    message_id=msg_id,
                ))

        except Exception as e:
            logger.exception("Error during agent run")
            yield encoder.encode(RunErrorEvent(
                type=EventType.RUN_ERROR,
                message=str(e),
            ))

        yield encoder.encode(RunFinishedEvent(
            type=EventType.RUN_FINISHED,
            thread_id=thread_id,
            run_id=run_id,
        ))

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
