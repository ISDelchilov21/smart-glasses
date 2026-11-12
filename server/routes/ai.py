from pathlib import Path
from threading import Lock

from fastapi import APIRouter, File, Form, UploadFile
from models.in_out_im import UserInput, AiResponse, EnrollResponse
import assistant
import web_tools

router = APIRouter()

PHONE_VOICE_FILE = Path(__file__).resolve().parent.parent.parent / "models" / "my_voice_phone.npy"
SPEAKER_THRESHOLD = 0.86

speech = None
voice_check = None
models_lock = Lock()


def get_speech():
    global speech
    with models_lock:
        if speech is None:
            import transcribe
            speech = transcribe.FileTranscriber()
    return speech


def get_voice_check():
    global voice_check
    with models_lock:
        if voice_check is None:
            import speaker
            voice_check = speaker.SpeakerCheck(SPEAKER_THRESHOLD, PHONE_VOICE_FILE)
    return voice_check


def set_location(latitude, longitude, city):
    known = latitude is not None and longitude is not None
    web_tools.LOCATION = {"latitude": latitude, "longitude": longitude, "city": city} if known else None


@router.get("/health", tags=["AI"])
def health():
    return {"status": "ok"}

@router.post("/process_text", response_model=AiResponse, tags=["AI"])
def process_text(user_input: UserInput):
    set_location(user_input.latitude, user_input.longitude, user_input.city)
    answer = assistant.ask_llm(user_input.text)
    return AiResponse(text=answer, tools=list(assistant.used_tools))

@router.post("/process_audio", response_model=AiResponse, tags=["AI"])
def process_audio(
    audio: UploadFile,
    wake: UploadFile | None = File(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    city: str | None = Form(None),
):
    import transcribe
    voice_match = None
    if wake is not None:
        mine, voice_match = get_voice_check().is_me(transcribe.load_audio(wake.file))
        if not mine:
            return AiResponse(text=f"That didn't sound like you (voice match {voice_match:.2f}), so I ignored it.",
                              heard="", voice_match=voice_match)
    heard = get_speech().transcribe_file(audio.file)
    if not heard:
        return AiResponse(text="I didn't hear anything. Try again a bit closer to the mic.", heard="",
                          voice_match=voice_match)
    set_location(latitude, longitude, city)
    answer = assistant.ask_llm(heard)
    return AiResponse(text=answer, tools=list(assistant.used_tools), heard=heard, voice_match=voice_match)

@router.post("/enroll_voice", response_model=EnrollResponse, tags=["AI"])
def enroll_voice(clips: list[UploadFile]):
    import transcribe
    similarities = get_voice_check().enroll([transcribe.load_audio(clip.file) for clip in clips])
    return EnrollResponse(similarities=similarities)
