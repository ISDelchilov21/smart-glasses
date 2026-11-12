"""The brain: the LLM (qwen3:1.7b, run by Ollama) with the phone tools.

The same code as in llm_model.ipynb, moved into a module so jarvis.py can import it.
"""
import json
from datetime import datetime

import ollama

import phone_tools
import web_tools

LLM_ID = "qwen3:1.7b"
TOOLS = phone_tools.TOOLS + web_tools.TOOLS
TOOLS_BY_NAME = {tool.__name__: tool for tool in TOOLS}

SYSTEM_PROMPT = (
    "You are a helpful voice assistant on smart glasses. "
    "The user's words come from speech recognition and may contain mistakes; guess what they meant. "
    "With your tools you can act on the user's Android phone, check the weather and search the web; "
    "use a tool only when the user's request needs one. "
    "Never answer about the weather, news, prices or sports results from memory; call a tool. "
    "When a tool can do what the user asks, call it right away: don't say you will do it and don't ask for permission. "
    "To call or text someone, pass their number or their name to the tool. Never make up phone numbers. "
    "Answer the user's latest message directly, in one or two short sentences."
)
MAX_TURNS = 6
history = [{"role": "system", "content": SYSTEM_PROMPT}]
used_tools = []


def warm_up():
    """The first request loads the model into memory (a few seconds); do it before the user is waiting."""
    ollama.chat(model=LLM_ID, messages=[{"role": "user", "content": "hi"}], think=False)


def new_conversation():
    """Forget everything except the system prompt."""
    del history[1:]


def tool_call_written_as_text(answer):
    """Small models sometimes write a tool call as plain text, e.g. {"name": "phone_status", "arguments": {...}},
    instead of using the tool-call format. If the answer is exactly that, turn it into a real tool call."""
    try:
        data = json.loads(answer[answer.find("{"): answer.rfind("}") + 1])
    except json.JSONDecodeError:
        return []
    if not isinstance(data, dict) or data.get("name") not in TOOLS_BY_NAME:
        return []
    function = ollama.Message.ToolCall.Function(name=data["name"], arguments=data.get("arguments") or {})
    return [ollama.Message.ToolCall(function=function)]


def run_tool(call):
    """Run the function the LLM asked for and return its result as text."""
    name, args = call.function.name, call.function.arguments
    tool = TOOLS_BY_NAME.get(name)
    try:
        result = tool(**args) if tool else f"Error: there is no tool called {name}."
    except TypeError as e:
        result = f"Error: wrong arguments for {name}: {e}"
    print(f"   [tool] {name}({args}) -> {result}")
    return result


def ask_llm(transcript, max_new_tokens=150):
    """Send one ASR transcript to the LLM, run any tools it asks for, stream the answer and return it."""
    history[0] = {"role": "system", "content": f"{SYSTEM_PROMPT} Right now it is {datetime.now():%A, %d %B %Y, %H:%M}."}
    history.append({"role": "user", "content": transcript})
    del history[1:-(2 * MAX_TURNS + 1)]
    used_tools.clear()

    while True:
        answer, tool_calls = "", []
        print("LLM:", end=" ", flush=True)
        for part in ollama.chat(
            model=LLM_ID,
            messages=history,
            tools=TOOLS,
            stream=True,
            think=False,
            options={"temperature": 0.7, "num_predict": max_new_tokens},
        ):
            print(part.message.content, end="", flush=True)
            answer += part.message.content
            tool_calls += part.message.tool_calls or []
        print()

        tool_calls = tool_calls or tool_call_written_as_text(answer)
        history.append({"role": "assistant", "content": answer.strip(), "tool_calls": tool_calls})
        if not tool_calls:
            return answer.strip()
        for call in tool_calls:
            used_tools.append(call.function.name)
            history.append({"role": "tool", "content": run_tool(call), "tool_name": call.function.name})
