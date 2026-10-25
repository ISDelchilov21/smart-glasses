"""What Jarvis shows the user. For now it prints to the terminal; later, this is the one place where
text gets sent to the glasses' display, so nothing else has to change."""
import re


def clean(text):
    text = re.sub(r"[*#_`>|~]", "", text)
    text = re.sub(r"[^\w\s.,!?;:'\"()%+\-/€$°]", "", text)
    return " ".join(text.split())


def show(text):
    print(f"\n[GLASSES] {clean(text)}")
