from speaker import SpeakerCheck
from wake_word import WakeWord

MIC = "Headset CMF WASAPI"
TRIES = 5

wake = WakeWord(MIC, threshold=0.3)
speaker = SpeakerCheck()

clips = []
for i in range(TRIES):
    print(f'Say "Hey Jarvis" ({i + 1}/{TRIES})...')
    clip, score = wake.wait()
    clips.append(clip)
    print(f"  got it (wake word score {score:.2f})")

similarities = speaker.enroll(clips)
print(f"\nSaved your voice profile to {speaker.profile_file}")
print("How close each try is to your profile:", [round(s, 2) for s in similarities])
print("Set SPEAKER_THRESHOLD in jarvis.py a bit below the lowest of these numbers.")
