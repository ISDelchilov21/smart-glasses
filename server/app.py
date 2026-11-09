import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))

from fastapi import FastAPI
from routes import ai

app = FastAPI()

app.include_router(ai.router)
