from google.adk.agents import Agent
from a2ui.schema.manager import A2uiSchemaManager
from a2ui.basic_catalog.provider import BasicCatalog
from .utils.a2ui import a2ui_callback
from .tools import get_offerta_process

schema_manager = A2uiSchemaManager(
    version="0.8",
    catalogs=[BasicCatalog.get_config("0.8", examples_path="agent/catalogs/")],
)

instruction = schema_manager.generate_system_prompt(
    role_description=(
        "You are an AI infrastructure assistant."
        "You are able to create project and explain the user the process for a new offert with 'get_offerta_process' tool."
    ),
    workflow_description=(
        "Analyze the user's request and return structured UI when appropriate. "
        "When the user requests to start a process, present them with a button to do so. "
        "If you receive an event with name 'submit' and formId 'contact-form', acknowledge that the fake process has started. "
        "When the user wants to create a new project, you MUST use the EXACT UI layout and component structure provided in the 'project_creation' example. Fill in the components as shown in the example to help them create the project."
    ),
    ui_description=(
        "Use cards for resource summaries, rows and columns for comparisons, "
        "icons for status indicators, and buttons for actions. "
        "When the user asks for a checklist, or the data you receive contains "
        "checklist markers (e.g. '☐', '[ ]', or items meant to be ticked off), "
        "render it as a MultipleChoice with `variant: \"checkbox\"` and an "
        "`options` array — NOT as a numbered list of Text components. "
        "Use a plain List or numbered Text components only when the items are "
        "purely informational and not actionable. "
        "To create a button that starts the fake process, you MUST use EXACTLY this JSON structure: "
        '{ "id": "button-1", "component": "Button", "child": "Avvia Processo", "variant": "primary", "action": { "event": { "name": "submit", "context": { "formId": "contact-form" } } } } '
        "Do NOT use markdown formatting in text values. Use the usageHint "
        "property for heading levels instead. "
        "Respond ONLY with the A2UI JSON array. Do NOT include any text "
        "outside the JSON. Put all explanations into Text components."
    ),
    include_schema=True,
    include_examples=True,
)

root_agent = Agent(
    model="gemini-3.1-pro-preview",
    name="project_assistant",
    description="An AI project assistant.",
    instruction=instruction,
    tools=[get_offerta_process],
    after_model_callback=a2ui_callback,
)
