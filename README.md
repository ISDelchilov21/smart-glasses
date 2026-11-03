# Smart Glasses: my own Jarvis

I've always wanted a Jarvis like Tony Stark's: something I can just talk to, that knows it's me, and that actually *does* things instead of only chatting. So I decided to build one, and to learn AI along the way.

The idea is a voice assistant for smart glasses. Right now it runs on my laptop with a headset microphone, and it can already control my Android phone. The glasses come later.

Everything runs locally. There are no cloud APIs, and no audio leaves my computer.

## What it does

I say **"Hey Jarvis"**, and then something like:

- *"Open YouTube"*, and YouTube opens on my phone.
- *"Call mom"*, and it finds her in my contacts and asks *"Should I call mom?"* It only calls after I say yes.
- *"Text Alex that I'm running late"*, and the SMS app opens with the message already written. I press send myself.
- *"Do I have any new messages?"*, and it reads my notifications.
- *"How's my battery?"*, and it tells me the battery, Wi-Fi, Bluetooth, Do Not Disturb, or storage status.
- *"Take me to Sofia Airport"*, and Google Maps starts navigation.

Or I just ask it a question, and it answers in a sentence or two, remembering what we talked about a moment ago.

I was careful about the scary parts. It never calls anyone without a clear spoken "yes" (silence or "no, wait" counts as no), it never sends messages by itself, and it never makes up phone numbers. If two contacts have the same name, it asks me which one I meant.

## How it works

It's a chain of four models, each doing one job:

```
"Hey Jarvis"  →  is it my voice?  →  speech to text  →  LLM decides  →  phone does it
 openWakeWord      WavLM              Nemotron          Qwen3 1.7B       ADB
```

**1. Waiting for "Hey Jarvis".** A tiny model ([openWakeWord](https://github.com/dscripka/openWakeWord)) listens all the time, but it only knows one phrase. Until it hears it, nothing else runs. That keeps things light, and it means nothing I say in normal conversation gets processed.

**2. Checking it's really me.** Glasses hear everyone around you, so I didn't want my friends saying "Hey Jarvis" and calling my mom. The audio of the wake word is turned into a "voiceprint" (512 numbers that describe how a voice sounds) with [`microsoft/wavlm-base-plus-sv`](https://huggingface.co/microsoft/wavlm-base-plus-sv), and compared to mine.

**3. Turning speech into text, live.** I started with Whisper, but it isn't built for streaming. I switched to NVIDIA's [`nemotron-speech-streaming-en-0.6b`](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b), which remembers what it already heard and only processes new audio. Words show up while I'm still talking, and a short pause ends the sentence.

**4. Deciding what to do.** The text goes to Qwen3 1.7B, running through [Ollama](https://ollama.com). It either answers, or it picks a "tool", a normal Python function like `open_app` or `make_phone_call`. My code runs the function, gives the result back to the LLM, and the LLM tells me what happened.

**5. Doing it on the phone.** The tools send commands to my Android phone over ADB.

The answer then goes to `display.py`. For now that just prints it, but later it's the one place that will send text to the glasses.

## Things that were harder than expected

- **Knowing when I stopped talking.** Streaming text is easy to print, but deciding "this sentence is finished" took real work.
- **The disappearing last word.** The standard text streamer holds back the last word until it sees a space after it, so when I paused, the last word of my sentence never arrived. I wrote a small custom streamer to fix it.
- **Small models and tools.** A 1.7B model sometimes writes a tool call as plain text instead of actually calling the tool, or stops halfway through a two-step task. I added a fallback that catches those, and made tools like "call mom" look up the contact themselves, so the model only needs one step.

## The code

```
src/
├── jarvis.py           the main loop that ties everything together
├── wake_word.py        "Hey Jarvis"
├── speaker.py          voiceprints and the "is it me?" check
├── enroll_voice.py     record my voice profile (run once)
├── asr_stream.py       live speech to text
├── assistant.py        the LLM, chat history and tool calling
├── phone_tools.py      everything Jarvis can do on the phone
├── display.py          what Jarvis shows (the terminal, for now)
├── wake_word_test.py   helper for tuning the wake word
├── asr_model.ipynb     my experiments with ASR (datasets, Whisper, Nemotron)
└── llm_model.ipynb     my experiments with the LLM and tools
```

## Try it yourself

You'll need Python 3.10 or newer, a microphone (a headset works best), an Android phone, and [Ollama](https://ollama.com). I built it on Windows.

1. Install the packages:
   ```bash
   pip install -U "transformers>=5.13.0" torch numpy sounddevice openwakeword onnxruntime ollama
   ```
2. Download the LLM:
   ```bash
   ollama pull qwen3:1.7b
   ```
3. Connect your phone: install [Android platform-tools](https://developer.android.com/tools/releases/platform-tools), turn on **USB debugging** in Developer options, plug the phone in, and check that `adb devices` lists it.
4. Change `MIC` in `jarvis.py` and `enroll_voice.py` to your microphone's name. `python -m sounddevice` lists them.
5. Teach Jarvis your voice (optional, but without it Jarvis listens to anyone):
   ```bash
   cd src
   python enroll_voice.py
   ```
   Say "Hey Jarvis" five times, then set `SPEAKER_THRESHOLD` in `jarvis.py` a bit below the lowest number it prints.
6. Start it:
   ```bash
   python jarvis.py
   ```
   The first start takes a minute or two while the models load.

If Jarvis reacts too easily or not at all, run `wake_word_test.py` to see the scores for your voice and adjust `WAKE_THRESHOLD`.

## What's next

Done so far:
- [x] Live speech to text
- [x] A local LLM that remembers the conversation and uses tools
- [x] Phone control: apps, calls, SMS, notifications, status, navigation
- [x] "Hey Jarvis"
- [x] Only reacting to my voice
- [x] Asking out loud before calling anyone

Still to do:
- [ ] Jarvis talking back (text-to-speech)
- [ ] Alarms, timers and calendar
- [ ] An Android app in Kotlin, so I don't need ADB
- [ ] The actual glasses: mic, speaker and a small display
- [ ] Running everything on the phone, fully offline

## Thanks

I learned most of this from the [Hugging Face Audio Course](https://huggingface.co/learn/audio-course) and [LLM Course](https://huggingface.co/learn/llm-course). Built with [Transformers](https://github.com/huggingface/transformers), [Ollama](https://ollama.com), [openWakeWord](https://github.com/dscripka/openWakeWord), [sounddevice](https://python-sounddevice.readthedocs.io) and [ADB](https://developer.android.com/tools/adb).
