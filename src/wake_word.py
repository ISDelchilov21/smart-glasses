"""Wake word: wait until someone says "Hey Jarvis" (openWakeWord: runs locally and is light enough to run all the time)."""
from collections import deque

import numpy as np
import sounddevice as sd
from openwakeword.model import Model
from openwakeword.utils import download_models

FRAME = 1280
CLIP_SECONDS = 2.0


class WakeWord:
    def __init__(self, mic=None, threshold=0.5):
        download_models(["hey_jarvis"])
        self.model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
        self.mic = mic
        self.threshold = threshold

    def wait(self):
        """Listen until "Hey Jarvis" is heard. Returns (clip, score): the last 2 seconds of audio, which contain
        the wake word (float numbers at 16 kHz, for the speaker check), and how sure the model was (0-1)."""
        recent = deque(maxlen=int(CLIP_SECONDS * 16000 / FRAME))
        self.model.reset()
        with sd.InputStream(device=self.mic, samplerate=16000, channels=1, dtype="int16", blocksize=FRAME) as stream:
            while True:
                audio, _ = stream.read(FRAME)
                recent.append(audio[:, 0])
                score = self.model.predict(audio[:, 0])["hey_jarvis"]
                if score >= self.threshold:
                    clip = np.concatenate(recent).astype(np.float32) / 32768
                    return clip, score
