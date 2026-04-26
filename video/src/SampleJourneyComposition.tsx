import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, GRADIENT } from "./constants";

const PANEL: React.CSSProperties = {
  borderRadius: 24,
  border: "1px solid #2f2f38",
  background: "linear-gradient(180deg, #1b1b22 0%, #111117 100%)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

export const SAMPLE_JOURNEY_FRAMES = 1800; // 60s

export const SampleJourneyComposition: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 200 } });
  const section = Math.floor(f / 450); // 15s blocks
  const sectionFrame = f % 450;
  const progress = Math.min(1, sectionFrame / 360);
  const fade = interpolate(sectionFrame, [0, 20, 420, 449], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titles = [
    "1) Initial Product Upload",
    "2) AI Prompt + Generation",
    "3) Before vs Final Ad Creative",
    "4) Export Campaign Assets",
  ];

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 20% 10%, #102a40 0%, #09090b 60%)" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.12, background: GRADIENT }} />

      <div style={{ position: "absolute", top: 64, left: 90, right: 90, textAlign: "center" }}>
        <div style={{ fontFamily: FONT, color: "white", fontWeight: 800, fontSize: 60 }}>
          Sample Product Journey
        </div>
        <div style={{ marginTop: 10, fontFamily: FONT, color: C.skyLight, fontSize: 28 }}>
          Wireless Earbuds Pro - from plain image to campaign-ready ads
        </div>
      </div>

      <div style={{ position: "absolute", top: 190, left: 110, right: 110, opacity: fade }}>
        <div style={{ ...PANEL, padding: "26px 30px" }}>
          <div style={{ color: C.skyLight, fontFamily: FONT, fontSize: 30, fontWeight: 700 }}>{titles[section]}</div>
          <div style={{ marginTop: 14, width: "100%", height: 12, borderRadius: 999, background: "#252530" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: GRADIENT }} />
          </div>
        </div>
      </div>

      {section === 0 ? (
        <div style={{ position: "absolute", top: 330, left: 220, right: 220, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, opacity: fade }}>
          <div style={{ ...PANEL, padding: 24 }}>
            <div style={{ color: "white", fontFamily: FONT, fontSize: 28, fontWeight: 700 }}>Initial Image</div>
            <div style={{ marginTop: 16, height: 360, borderRadius: 16, background: "#0f172a", border: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontFamily: FONT, fontSize: 24 }}>
              Plain product shot
            </div>
          </div>
          <div style={{ ...PANEL, padding: 24 }}>
            <div style={{ color: "white", fontFamily: FONT, fontSize: 28, fontWeight: 700 }}>Product Details</div>
            <div style={{ marginTop: 16, color: "#e4e4e7", fontFamily: FONT, fontSize: 23, lineHeight: 1.7 }}>
              Name: Wireless Earbuds Pro
              <br />Category: Electronics
              <br />Features: Noise cancellation, 24hr battery, waterproof
              <br />Audience: Tech-savvy millennials
            </div>
          </div>
        </div>
      ) : null}

      {section === 1 ? (
        <div style={{ position: "absolute", top: 330, left: 170, right: 170, opacity: fade }}>
          <div style={{ ...PANEL, padding: 28 }}>
            <div style={{ color: "white", fontFamily: FONT, fontSize: 30, fontWeight: 700 }}>
              Prompt: "Energetic modern earbuds ad with lifestyle vibe"
            </div>
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              {[1, 2, 3].map((v) => (
                <div key={v} style={{ ...PANEL, padding: 16, transform: `scale(${0.96 + pop * 0.04})` }}>
                  <div style={{ color: C.skyLight, fontFamily: FONT, fontSize: 20 }}>Variation {v}</div>
                  <div style={{ marginTop: 10, height: 260, borderRadius: 12, background: "#111827", border: "1px solid #374151" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {section === 2 ? (
        <div style={{ position: "absolute", top: 300, left: 170, right: 170, display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 24, alignItems: "center", opacity: fade }}>
          <div style={{ ...PANEL, padding: 22 }}>
            <div style={{ color: "#fca5a5", fontFamily: FONT, fontSize: 26, fontWeight: 700 }}>Before</div>
            <div style={{ marginTop: 14, height: 380, borderRadius: 14, background: "#111827", border: "1px solid #374151" }} />
          </div>
          <div style={{ textAlign: "center", fontFamily: FONT, color: C.skyLight, fontWeight: 800, fontSize: 42 }}>→</div>
          <div style={{ ...PANEL, padding: 22 }}>
            <div style={{ color: "#86efac", fontFamily: FONT, fontSize: 26, fontWeight: 700 }}>Final Ad</div>
            <div style={{ marginTop: 14, height: 380, borderRadius: 14, background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", border: "1px solid #6366f1" }} />
          </div>
        </div>
      ) : null}

      {section === 3 ? (
        <div style={{ position: "absolute", top: 330, left: 200, right: 200, opacity: fade }}>
          <div style={{ ...PANEL, padding: 30 }}>
            <div style={{ color: "white", fontFamily: FONT, fontSize: 34, fontWeight: 700, textAlign: "center" }}>
              Export Ready
            </div>
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
              {["Instagram Story (9:16)", "Facebook Feed (1:1)", "Google Banner (728x90)"].map((x) => (
                <div key={x} style={{ ...PANEL, padding: 18, textAlign: "center", color: "white", fontFamily: FONT, fontSize: 22 }}>
                  {x}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 30, textAlign: "center" }}>
              <span style={{ display: "inline-block", background: GRADIENT, padding: "14px 28px", borderRadius: 12, color: "white", fontFamily: FONT, fontSize: 26, fontWeight: 700 }}>
                Download and Launch Campaign
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
