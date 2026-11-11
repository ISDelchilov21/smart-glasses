from pydantic import BaseModel

class UserInput(BaseModel):
    text: str

class AiResponse(BaseModel):
    text: str
    tools: list[str] = []
    heard: str | None = None
