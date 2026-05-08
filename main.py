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

        try:
            msg_id = _make_id("msg")
            text_open = False
            text_buffer = ""
            text_decided = False
            text_suppressed = False
            sent_tool_calls: set[str] = set()

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
                        # The model is instructed to reply with A2UI JSON only,
                        # wrapped in <a2ui-json>...</a2ui-json>. Sniff the buffer
                        # for these markers and suppress text events so the raw
                        # JSON doesn't appear next to the rendered component.
                        if part.text:
                            if text_suppressed:
                                continue
                            if not text_decided:
                                text_buffer += part.text
                                stripped = text_buffer.lstrip()
                                if not stripped:
                                    continue  # keep buffering whitespace
                                a2ui_tag = "<a2ui-json>"
                                a2ui_keywords = ("beginRendering", "surfaceUpdate", "dataModelUpdate")
                                if (
                                    stripped[0] in ("[", "{")
                                    or stripped.startswith("```")
                                    or stripped.startswith(a2ui_tag)
                                    or any(kw in text_buffer for kw in a2ui_keywords)
                                ):
                                    text_suppressed = True
                                    text_decided = True
                                    text_buffer = ""
                                    continue
                                # Possibly a partial A2UI tag spanning chunks — keep buffering
                                if stripped.startswith("<") and len(stripped) < len(a2ui_tag) and a2ui_tag.startswith(stripped):
                                    continue
                                text_decided = True
                                yield encoder.encode(TextMessageStartEvent(
                                    type=EventType.TEXT_MESSAGE_START,
                                    message_id=msg_id,
                                    role="assistant",
                                ))
                                text_open = True
                                yield encoder.encode(TextMessageContentEvent(
                                    type=EventType.TEXT_MESSAGE_CONTENT,
                                    message_id=msg_id,
                                    delta=text_buffer,
                                ))
                                text_buffer = ""
                                continue
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
                                delta=part.text,
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
