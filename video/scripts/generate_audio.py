import math
import wave
import struct
from pathlib import Path

import pyttsx3

SAMPLE_RATE = 48_000

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "assets"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def make_background_music(path: Path, duration_seconds: int = 120) -> None:
    frames = SAMPLE_RATE * duration_seconds
    chord_progression = [
        (261.63, 329.63, 392.00),  # C major
        (220.00, 277.18, 329.63),  # A minor
        (246.94, 311.13, 369.99),  # B diminished-ish
        (196.00, 246.94, 392.00),  # G major
    ]
    beat_hz = 2.0

    with wave.open(str(path), "w") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)

        for i in range(frames):
            t = i / SAMPLE_RATE
            chord_index = int((t // 2.0) % len(chord_progression))
            chord = chord_progression[chord_index]
            pulse = 0.7 + 0.3 * math.sin(2 * math.pi * beat_hz * t)

            signal = 0.0
            for freq in chord:
                signal += math.sin(2 * math.pi * freq * t) * 0.22
                signal += math.sin(2 * math.pi * (freq * 2) * t) * 0.06

            pad = math.sin(2 * math.pi * 110 * t) * 0.05
            value = (signal * pulse + pad) * 0.18
            value = max(-1.0, min(1.0, value))
            sample = int(value * 32767)
            wav.writeframes(struct.pack("<hh", sample, sample))


def make_voiceover(path: Path) -> None:
    script = [
        "Introducing Product Ad Generator - Transform your products into compelling ads in minutes.",
        "Creating product ads should not be complicated or expensive.",
        "Meet Product Ad Generator - Your AI Marketing Assistant, powered by advanced AI to create professional ads instantly.",
        "Getting started is simple. Step 1: Upload your product image or paste a URL. We support all major image formats.",
        "Step 2: Provide basic product details - name, features, target audience, and your preferred tone. Our AI handles the rest.",
        "Watch as our AI analyzes your product and generates multiple ad variations in seconds.",
        "Get multiple ready-to-use ad formats optimized for Instagram, Facebook, Google, LinkedIn, and more - all from a single product upload.",
        "Customize every detail or export immediately. Edit copy, change designs, run A slash B tests, and download in any format you need.",
        "Join thousands of marketers creating better ads, faster. Start creating free today. Product Ad Generator - Where AI meets creativity.",
    ]

    engine = pyttsx3.init()
    engine.setProperty("rate", 165)
    engine.setProperty("volume", 0.95)
    voices = engine.getProperty("voices")
    if voices:
        engine.setProperty("voice", voices[0].id)

    # pyttsx3 can queue speech with pauses by inserting short utterances.
    engine.save_to_file(" ".join(script), str(path))
    engine.runAndWait()


if __name__ == "__main__":
    make_background_music(OUT_DIR / "bg-music.wav")
    make_voiceover(OUT_DIR / "voiceover.wav")
    print("Generated audio tracks in", OUT_DIR)
