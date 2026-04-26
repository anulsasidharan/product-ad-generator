import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FONT, GRADIENT, SCENES } from "./constants";

const card = (w: number, h: number): React.CSSProperties => ({
  width: w,
  height: h,
  borderRadius: 24,
  background: "linear-gradient(180deg, #1f1f25 0%, #131319 100%)",
  border: "1px solid #2b2b35",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
});

const screenCard: React.FC<{ title: string; subtitle?: string; width?: number; height?: number }> = ({
  title,
  subtitle,
  width = 1320,
  height = 740,
}) => (
  <div style={{ ...card(width, height), padding: 30 }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
        <div key={c} style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: c }} />
      ))}
    </div>
    <div style={{ color: "white", fontFamily: FONT, fontSize: 42, fontWeight: 700 }}>{title}</div>
    {subtitle ? <div style={{ color: C.mutedLight, fontFamily: FONT, fontSize: 22, marginTop: 8 }}>{subtitle}</div> : null}
  </div>
);

const Scene1Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 25% 20%, #13395a 0%, #09090b 60%)" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.2, background: GRADIENT }} />
      <div style={{ margin: "auto", textAlign: "center", transform: `scale(${0.9 + 0.1 * enter})`, opacity: enter }}>
        <div style={{ fontSize: 76, fontFamily: FONT, fontWeight: 800, color: "white" }}>Product Ad Generator</div>
        <div style={{ marginTop: 10, fontSize: 32, color: C.skyLight, fontFamily: FONT }}>Where AI Meets Creativity</div>
        <div style={{ marginTop: 26, fontSize: 38, color: "white", fontFamily: FONT, fontWeight: 600 }}>
          Transform Your Products into Compelling Ads in Minutes
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene2Problem: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, display: "flex", flexDirection: "row", gap: 24, padding: 70 }}>
    <div style={{ ...card(880, 860), padding: 38 }}>
      <div style={{ color: C.red, fontSize: 42, fontFamily: FONT, fontWeight: 700 }}>Manual Workflow</div>
      <div style={{ color: "white", marginTop: 24, fontSize: 30, fontFamily: FONT, lineHeight: 1.5 }}>
        - Frustrated marketer switching tools
        <br />- Endless revisions and delays
        <br />- Inconsistent brand output
      </div>
    </div>
    <div style={{ ...card(880, 860), padding: 38 }}>
      <div style={{ color: C.amber, fontSize: 42, fontFamily: FONT, fontWeight: 700 }}>Agency Bottlenecks</div>
      <div style={{ color: "white", marginTop: 24, fontSize: 30, fontFamily: FONT, lineHeight: 1.5 }}>
        - High creative costs
        <br />- Time-consuming brief cycles
        <br />- Slow campaign launch
      </div>
    </div>
  </AbsoluteFill>
);

const Scene3Solution: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
    {screenCard({ title: "Product Ad Generator Dashboard", subtitle: "Your AI Marketing Assistant" })}
    <div style={{ position: "absolute", top: 360, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {["AI-Powered Generation ⚡", "Multiple Ad Formats 📱", "Instant Results ⏱️", "Professional Quality ✨"].map((t) => (
        <div key={t} style={{ ...card(500, 100), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: FONT, fontSize: 26, fontWeight: 600 }}>{t}</div>
      ))}
    </div>
  </AbsoluteFill>
);

const Scene4Upload: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
    {screenCard({ title: "Step 1: Upload Product", subtitle: "Get Started" })}
    <div style={{ position: "absolute", top: 340, width: 1160, height: 340, borderRadius: 20, border: `2px dashed ${C.sky}`, color: "white", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
      Drag & drop your product image here
    </div>
    <div style={{ position: "absolute", top: 710, color: C.mutedLight, fontFamily: FONT, fontSize: 24 }}>Or paste product URL - Supports: JPG, PNG, WEBP</div>
  </AbsoluteFill>
);

const Scene5Details: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
    {screenCard({ title: "Step 2: Product Details", subtitle: "Tell us about your product" })}
    <div style={{ position: "absolute", top: 320, width: 1160, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      {[
        "Product Name: Wireless Earbuds Pro",
        "Category: Electronics",
        "Key Features: Noise cancellation, 24hr battery, waterproof",
        "Target Audience: Tech-savvy millennials",
        "Tone: Energetic and modern",
      ].map((x) => (
        <div key={x} style={{ ...card(1160, 72), border: "1px solid rgba(14,165,233,0.55)", color: "white", fontFamily: FONT, fontSize: 24, padding: "18px 24px" }}>{x}</div>
      ))}
    </div>
  </AbsoluteFill>
);

const Scene6AI: React.FC = () => {
  const f = useCurrentFrame();
  const progress = Math.min(1, f / 420);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 75% 20%, #31174f 0%, #09090b 60%)", alignItems: "center", justifyContent: "center" }}>
      {screenCard({ title: "AI Generation in Progress", subtitle: "Optimizing your ads..." })}
      <div style={{ position: "absolute", top: 360, width: 1100, color: "white", fontFamily: FONT, fontSize: 30, lineHeight: 1.7 }}>
        <div>🤖 Analyzing product features...</div>
        <div>✍️ Crafting compelling copy...</div>
        <div>🎨 Generating visual layouts...</div>
        <div>✨ Optimizing for engagement...</div>
      </div>
      <div style={{ position: "absolute", top: 700, width: 1100, height: 20, borderRadius: 999, background: "#1f2937" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: GRADIENT }} />
      </div>
    </AbsoluteFill>
  );
};

const Scene7Results: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, 250], [1.05, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center", transform: `scale(${zoom})` }}>
      <div style={{ color: "white", fontFamily: FONT, fontSize: 40, fontWeight: 800, marginBottom: 20 }}>Generated Multi-Platform Ad Formats</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {[
          "Instagram Story Ad (9:16)",
          "Facebook Feed Ad (1:1)",
          "Google Display Ad (728x90)",
          "LinkedIn Sponsored Post",
        ].map((n) => (
          <div key={n} style={{ ...card(800, 250), padding: 18, color: "white", fontFamily: FONT, fontSize: 26 }}>
            <div style={{ fontWeight: 700 }}>{n}</div>
            <div style={{ marginTop: 14, fontSize: 19, color: C.mutedLight }}>Optimized copy, CTA, and visual hierarchy.</div>
            <div style={{ marginTop: 14, display: "inline-block", borderRadius: 999, background: GRADIENT, padding: "6px 14px", fontSize: 16 }}>Preview Interactive</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Scene8Customization: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
    {screenCard({ title: "Customize or Export Instantly", subtitle: "Full creative control" })}
    <div style={{ position: "absolute", top: 380, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      {["✏️ Edit Copy", "🎨 Customize Design", "📊 A/B Testing", "💾 Download & Share"].map((t) => (
        <div key={t} style={{ ...card(520, 100), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: FONT, fontSize: 28, fontWeight: 600 }}>{t}</div>
      ))}
    </div>
  </AbsoluteFill>
);

const Scene9CTA: React.FC = () => {
  const f = useCurrentFrame();
  const pulse = 1 + Math.sin(f / 10) * 0.04;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 35% 0%, #102b44 0%, #09090b 65%)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "white", fontSize: 72, fontFamily: FONT, fontWeight: 800 }}>Product Ad Generator</div>
      <div style={{ marginTop: 20, color: C.skyLight, fontFamily: FONT, fontSize: 34 }}>1000+ Ads Daily • 95% Satisfaction • Save 10+ Hours/Week</div>
      <div style={{ marginTop: 40, transform: `scale(${pulse})`, background: GRADIENT, color: "white", fontFamily: FONT, fontWeight: 800, fontSize: 36, padding: "20px 46px", borderRadius: 16 }}>
        Start Creating Free
      </div>
      <div style={{ marginTop: 24, color: "white", fontFamily: FONT, fontSize: 27 }}>FREE: 5/month • PRO: $29/month • ENTERPRISE: Custom</div>
      <div style={{ marginTop: 30, color: C.mutedLight, fontFamily: FONT, fontSize: 24 }}>productadgenerator.com</div>
    </AbsoluteFill>
  );
};

export const VideoComposition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Audio src={staticFile("bg-music.wav")} volume={0.28} />
    <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.duration}>
      <Audio src={staticFile("tour-voice/line-1.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
      <Audio src={staticFile("tour-voice/line-2.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.solution.from} durationInFrames={SCENES.solution.duration}>
      <Audio src={staticFile("tour-voice/line-3.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.upload.from} durationInFrames={SCENES.upload.duration}>
      <Audio src={staticFile("tour-voice/line-4.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.details.from} durationInFrames={SCENES.details.duration}>
      <Audio src={staticFile("tour-voice/line-5.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.aiGen.from} durationInFrames={SCENES.aiGen.duration}>
      <Audio src={staticFile("tour-voice/line-6.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.results.from} durationInFrames={SCENES.results.duration}>
      <Audio src={staticFile("tour-voice/line-7.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.customize.from} durationInFrames={SCENES.customize.duration}>
      <Audio src={staticFile("tour-voice/line-8.wav")} volume={1} />
    </Sequence>
    <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration}>
      <Audio src={staticFile("tour-voice/line-9.wav")} volume={1} />
    </Sequence>

    <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.duration}>
      <Scene1Intro />
    </Sequence>
    <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
      <Scene2Problem />
    </Sequence>
    <Sequence from={SCENES.solution.from} durationInFrames={SCENES.solution.duration}>
      <Scene3Solution />
    </Sequence>
    <Sequence from={SCENES.upload.from} durationInFrames={SCENES.upload.duration}>
      <Scene4Upload />
    </Sequence>
    <Sequence from={SCENES.details.from} durationInFrames={SCENES.details.duration}>
      <Scene5Details />
    </Sequence>
    <Sequence from={SCENES.aiGen.from} durationInFrames={SCENES.aiGen.duration}>
      <Scene6AI />
    </Sequence>
    <Sequence from={SCENES.results.from} durationInFrames={SCENES.results.duration}>
      <Scene7Results />
    </Sequence>
    <Sequence from={SCENES.customize.from} durationInFrames={SCENES.customize.duration}>
      <Scene8Customization />
    </Sequence>
    <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration}>
      <Scene9CTA />
    </Sequence>
  </AbsoluteFill>
);
