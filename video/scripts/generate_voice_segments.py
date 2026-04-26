from pathlib import Path
import pyttsx3

OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "tour-voice"
OUT_DIR.mkdir(parents=True, exist_ok=True)

LINES = [
    "Introducing Product Ad Generator - Transform your products into compelling ads in minutes.",
    "Creating product ads should not be complicated or expensive.",
    "Meet Product Ad Generator - Your AI Marketing Assistant, powered by advanced AI to create professional ads instantly.",
    "Getting started is simple. Step 1: Upload your product image or paste a URL. We support all major image formats.",
    "Step 2: Provide basic product details - name, features, target audience, and your preferred tone. Our AI handles the rest.",
    "Watch as our AI analyzes your product and generates multiple ad variations in seconds.",
    "Get multiple ready-to-use ad formats optimized for Instagram, Facebook, Google, LinkedIn, and more - all from a single product upload.",
    "Customize every detail or export immediately. Edit copy, change designs, run A B tests, and download in any format you need.",
    "Join thousands of marketers creating better ads, faster. Start creating free today. Product Ad Generator - Where AI meets creativity.",
]


def main() -> None:
    engine = pyttsx3.init()
    engine.setProperty("rate", 160)
    engine.setProperty("volume", 0.95)
    voices = engine.getProperty("voices")
    if voices:
        engine.setProperty("voice", voices[0].id)

    for idx, line in enumerate(LINES, start=1):
        out = OUT_DIR / f"line-{idx}.wav"
        engine.save_to_file(line, str(out))

    engine.runAndWait()
    print(f"Wrote {len(LINES)} voice segments to {OUT_DIR}")


if __name__ == "__main__":
    main()
