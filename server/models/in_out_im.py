from pydantic import BaseModel

class UserInput(BaseModel):
    text: str
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None

class AiResponse(BaseModel):
    text: str
    tools: list[str] = []
    heard: str | None = None
    voice_match: float | None = None

class EnrollResponse(BaseModel):
    similarities: list[float]
