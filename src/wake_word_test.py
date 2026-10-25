
import sounddevice as sd
from openwakeword.model import Model
from openwakeword.utils import download_models

MIC = "Headset CMF WASAPI"
THRESHOLD = 0.5
FRAME = 1280

download_models(["hey_jarvis"])
model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")

with sd.InputStream(device=MIC, samplerate=16000, channels=1, dtype="int16", blocksize=FRAME) as stream:
    print('Listening... say "Hey Jarvis" (Ctrl+C to stop)')
    try:
        while True:
            audio, _ = stream.read(FRAME)
            score = model.predict(audio[:, 0])["hey_jarvis"]
            if score > 0.1:
                print(f"score {score:.2f}" + ("   <-- WAKE WORD!" if score >= THRESHOLD else ""))
            if score >= THRESHOLD:
                model.reset()
    except KeyboardInterrupt:
        print("Stopped.")
