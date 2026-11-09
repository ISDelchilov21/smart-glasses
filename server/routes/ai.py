from fastapi import APIRouter
from models.in_out_im import UserInput, AiResponse
import assistant

router = APIRouter()

@router.post("/process_text", response_model=AiResponse, tags=["AI"])
def process_text(user_input: UserInput):
    answer = assistant.ask_llm(user_input.text)
    return AiResponse(text=answer)
