
print("Starting Jarvis: loading the libraries and models takes 1-2 minutes...")

import re

import assistant
import phone_tools
from asr_stream import LiveTranscriber
from display import show
from speaker import SpeakerCheck
from wake_word import WakeWord

MIC = "Headset CMF WASAPI"
WAKE_THRESHOLD = 0.45
SPEAKER_THRESHOLD = 0.86
LISTEN_SECONDS = 6

YES_WORDS = {"yes", "yeah", "yep", "yup", "sure", "ok", "okay", "correct", "please", "ahead"}
NO_WORDS = {"no", "nope", "not", "don't", "dont", "cancel", "stop", "wait"}


def is_yes(answer):
    """True only for a clear yes. If "no" is in it too ("no, wait"), it's a no; silence or anything unclear is a no."""
    words = set(re.findall(r"[a-z']+", answer.lower()))
    return bool(words & YES_WORDS) and not (words & NO_WORDS)


def main():
    print("Loading the models (about a minute)...")
    wake = WakeWord(MIC, WAKE_THRESHOLD)
    speaker = SpeakerCheck(SPEAKER_THRESHOLD)
    asr = LiveTranscriber(mic=MIC)
    assistant.warm_up()

    def confirm(question):
        """Show a yes/no question and listen for the spoken answer (used before calling someone)."""
        show(f"{question} (say yes or no)")
        answer = asr.listen_once(give_up_seconds=LISTEN_SECONDS)
        print(f"   [confirm] heard {answer!r}")
        return is_yes(answer)

    phone_tools.DRY_RUN = False
    phone_tools.CONFIRM = confirm
    if speaker.profile is None:
        print("No voice profile yet, so Jarvis reacts to anyone. Run enroll_voice.py to record yours.")

    show("Jarvis is ready.")
    while True:
        print('\nWaiting for "Hey Jarvis"...')
        clip, score = wake.wait()
        mine, similarity = speaker.is_me(clip)
        if not mine:
            print(f"   heard the wake word (score {score:.2f}), but not your voice (similarity {similarity:.2f})")
            continue
        print(f"   wake word (score {score:.2f})" + (f", your voice (similarity {similarity:.2f})" if similarity else ""))
        show("Listening...")
        request = asr.listen_once(give_up_seconds=LISTEN_SECONDS)
        if not request:
            show("I didn't hear anything.")
            continue
        show(assistant.ask_llm(request))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nJarvis stopped.")
