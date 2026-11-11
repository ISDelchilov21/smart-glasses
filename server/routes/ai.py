from threading import Lock

from fastapi import APIRouter, UploadFile
from models.in_out_im import UserInput, AiResponse
import assistant

router = APIRouter()

speech = None
speech_lock = Lock()


def get_speech():
    global speech
    with speech_lock:
        if speech is None:
            import transcribe
            speech = transcribe.FileTranscriber()
    return speech


@router.get("/health", tags=["AI"])
def health():
    return {"status": "ok"}

@router.post("/process_text", response_model=AiResponse, tags=["AI"])
def process_text(user_input: UserInput):
    answer = assistant.ask_llm(user_input.text)
    return AiResponse(text=answer, tools=list(assistant.used_tools))

@router.post("/process_audio", response_model=AiResponse, tags=["AI"])
def process_audio(audio: UploadFile):
    heard = get_speech().transcribe_file(audio.file)
    if not heard:
        return AiResponse(text="I didn't hear anything. Try again a bit closer to the mic.", heard="")
    answer = assistant.ask_llm(heard)
    return AiResponse(text=answer, tools=list(assistant.used_tools), heard=heard)
