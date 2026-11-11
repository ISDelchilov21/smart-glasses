# Smart Glasses: my own Jarvis

I've always wanted a Jarvis like Tony Stark's: something I can just talk to, that knows it's me, and that actually *does* things instead of only chatting. So I decided to build one, and to learn AI along the way.

The idea is a voice assistant for smart glasses. Right now it runs as an **app on my Android phone** that talks to a **server on my laptop**, and the phone can be controlled by voice. There's also the original laptop-only version with a headset microphone. The glasses come later: they will show Jarvis's answers on a small display.

Everything runs on my own devices. The AI models run locally, there are no cloud AI APIs, and no audio leaves my phone and laptop.

## What it does

I say **"Hey Jarvis"** to my phone (or tap the mic, or just type), and then something like:

- *"Open YouTube"*, and YouTube opens on my phone.
- *"Call mom"*, and it finds her in my contacts and opens the dialer with her number. I press call myself. (In the laptop version it asks *"Should I call mom?"* out loud and only calls after I say yes.)
- *"Text Alex that I'm running late"*, and the SMS app opens with the message already written. I press send myself.
- *"What's Alex's number?"*, and it looks it up in my contacts.
- *"Set an alarm for 2 pm"*, or *"wake me up in 20 minutes"*, and the alarm is set.
- *"Do I have any new messages?"*, and it reads my notifications.
- *"How's my battery?"*, and it tells me the battery, Wi-Fi, Bluetooth, Do Not Disturb, or storage status.
- *"Take me to Sofia Airport"*, and Google Maps starts navigation.

Or I just ask it a question, and it answers in a sentence or two, remembering what we talked about a moment ago.

I was careful about the scary parts. It never calls anyone or sends a message by itself, it never makes up phone numbers, and if two contacts have the same name, it asks me which one I meant.

## How it works

It's a chain of models, each doing one job:

```
"Hey Jarvis"  →  is it my voice?  →  speech to text  →  LLM decides  →  phone does it
 openWakeWord      WavLM              Nemotron          Qwen3 1.7B       ADB
```

**1. Waiting for "Hey Jarvis".** A tiny model ([openWakeWord](https://github.com/dscripka/openWakeWord)) listens all the time, but it only knows one phrase. Until it hears it, nothing is recorded or sent anywhere. In the phone app, this model runs **on the phone itself**: I rewrote openWakeWord's audio steps in TypeScript and run its three small models with ONNX Runtime. I checked it against the original Python version on the same recordings, and the scores match exactly (0.998 for "Hey Jarvis", 0.283 for "Hey Travis").

**2. Checking it's really me** (laptop version, for now). Glasses hear everyone around you, so I didn't want my friends saying "Hey Jarvis" and calling my mom. The audio of the wake word is turned into a "voiceprint" (512 numbers that describe how a voice sounds) with [`microsoft/wavlm-base-plus-sv`](https://huggingface.co/microsoft/wavlm-base-plus-sv), and compared to mine.

**3. Turning speech into text.** I started with Whisper, but it isn't built for streaming. I switched to NVIDIA's [`nemotron-speech-streaming-en-0.6b`](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b). On the laptop it transcribes live, and words show up while I'm still talking. In the phone app, the phone records until I stop talking for a second, sends the recording to the server, and the server transcribes it.

**4. Deciding what to do.** The text goes to Qwen3 1.7B, running through [Ollama](https://ollama.com). It either answers, or it picks a "tool", a normal Python function like `open_app` or `set_alarm`. My code runs the function, gives the result back to the LLM, and the LLM tells me what happened.

**5. Doing it on the phone.** The tools send commands to my Android phone over ADB.

The answer then appears in the app's chat. In the laptop version it goes to `display.py`, which for now just prints it; later that's the one place that will send text to the glasses.

## Things that were harder than expected

- **Knowing when I stopped talking.** Streaming text is easy to print, but deciding "this sentence is finished" took real work, both for live transcription on the laptop and for recording on the phone.
- **The disappearing last word.** The standard text streamer holds back the last word until it sees a space after it, so when I paused, the last word of my sentence never arrived. I wrote a small custom streamer to fix it.
- **Small models and tools.** A 1.7B model sometimes writes a tool call as plain text instead of actually calling the tool, stops halfway through a two-step task, or turns "2 pm" into 2 at night. So I let code do the exact work: tools like "call mom" look up the contact themselves, and `set_alarm` gets the time as words ("quarter past six in the evening") and converts it in Python. I test every tool with many phrasings before adding it.
- **An older library in a new app.** ONNX Runtime's React Native library used a build feature that newer Gradle removed, and an old config file made Expo skip registering it, so the app couldn't find it. I fixed both with a small patch (`sg-app/patches/`) that is applied automatically after every `npm install`.

## The code

```
src/                     the AI part (Python)
├── assistant.py         the LLM, chat history and tool calling
├── phone_tools.py       everything Jarvis can do on the phone
├── transcribe.py        speech to text for recordings from the app
├── jarvis.py            the laptop version's main loop
├── wake_word.py         "Hey Jarvis" on the laptop
├── speaker.py           voiceprints and the "is it me?" check
├── enroll_voice.py      record my voice profile (run once)
├── asr_stream.py        live speech to text
├── display.py           what Jarvis shows (the terminal, for now)
├── wake_word_test.py    helper for tuning the wake word
├── asr_model.ipynb      my experiments with ASR (datasets, Whisper, Nemotron)
└── llm_model.ipynb      my experiments with the LLM and tools

server/                  FastAPI server the app talks to
├── app.py
├── routes/ai.py         /health, /process_text and /process_audio
└── models/in_out_im.py  the shape of requests and answers

sg-app/                  the phone app (Expo / React Native)
├── src/app/             the chat and settings screens
├── src/lib/             server connection, wake word, microphone
├── assets/models/       the three openWakeWord models
└── patches/             the fix for ONNX Runtime
```

## Try it yourself

You'll need an Android phone with **USB debugging** turned on (in Developer options), [Android platform-tools](https://developer.android.com/tools/releases/platform-tools) so that `adb devices` lists your phone, and [Ollama](https://ollama.com) with the LLM:
```bash
ollama pull qwen3:1.7b
```
I built it on Windows.

### The phone app

1. **Start the server** (needs Python 3.12 and [uv](https://docs.astral.sh/uv/)). Keep the phone plugged in, because the tools control it over ADB:
   ```bash
   cd server
   uv sync
   uv run fastapi dev app.py
   ```
   The first voice message takes about a minute while Nemotron loads.
2. **Build the app.** The wake word needs native code, so the app doesn't run in Expo Go; it needs its own development build. Make one with a free [Expo](https://expo.dev) account:
   ```bash
   cd sg-app
   npm install
   npx eas-cli login
   npx eas-cli build --profile development --platform android
   ```
   Open the link it prints on your phone and install the app.
3. **Connect the phone to the laptop over USB**, and start the app's dev server:
   ```bash
   adb reverse tcp:8000 tcp:8000
   adb reverse tcp:8081 tcp:8081
   npx expo start
   ```
4. Open the app, allow the microphone, and say **"Hey Jarvis"**.

### The laptop version

1. Install the packages (Python 3.10 or newer, and a microphone; a headset works best):
   ```bash
   pip install -U "transformers>=5.13.0" torch numpy sounddevice openwakeword onnxruntime ollama
   ```
2. Change `MIC` in `jarvis.py` and `enroll_voice.py` to your microphone's name. `python -m sounddevice` lists them.
3. Teach Jarvis your voice (optional, but without it Jarvis listens to anyone):
   ```bash
   cd src
   python enroll_voice.py
   ```
   Say "Hey Jarvis" five times, then set `SPEAKER_THRESHOLD` in `jarvis.py` a bit below the lowest number it prints.
4. Start it:
   ```bash
   python jarvis.py
   ```
   The first start takes a minute or two while the models load.

If Jarvis reacts too easily or not at all, run `wake_word_test.py` to see the scores for your voice and adjust `WAKE_THRESHOLD`.

## What's next

Done so far:
- [x] Live speech to text
- [x] A local LLM that remembers the conversation and uses tools
- [x] Phone control: apps, calls, SMS, contacts, alarms, notifications, status, navigation
- [x] "Hey Jarvis"
- [x] Only reacting to my voice (laptop version)
- [x] Asking out loud before calling anyone (laptop version)
- [x] A phone app with chat and voice, and a server it talks to
- [x] "Hey Jarvis" running on the phone itself

Still to do:
- [ ] The actual glasses: a microphone and a small display that shows Jarvis's answers
- [ ] Real-time information: date and time, weather, web search
- [ ] The "is it me?" voice check in the phone app
- [ ] Listening while the app is in the background
- [ ] Hosting the server, so the phone doesn't need the USB cable
- [ ] Timers and calendar
- [ ] Running everything on the phone, fully offline

## Thanks

I learned most of this from the [Hugging Face Audio Course](https://huggingface.co/learn/audio-course) and [LLM Course](https://huggingface.co/learn/llm-course). Built with [Transformers](https://github.com/huggingface/transformers), [Ollama](https://ollama.com), [openWakeWord](https://github.com/dscripka/openWakeWord), [sounddevice](https://python-sounddevice.readthedocs.io), [ADB](https://developer.android.com/tools/adb), [FastAPI](https://fastapi.tiangolo.com), [Expo](https://expo.dev), [React Native](https://reactnative.dev), [ONNX Runtime](https://onnxruntime.ai) and Picovoice's [voice processor](https://github.com/Picovoice/react-native-voice-processor).

The wake word models in `sg-app/assets/models/` come from openWakeWord and are licensed for non-commercial use only ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
