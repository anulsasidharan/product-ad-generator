export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 3600; // 120s at 30fps

export const C = {
  bg: "#09090b",
  bgCard: "#18181b",
  bgCardBorder: "#27272a",
  violet: "#8b5cf6",
  violetLight: "#a78bfa",
  violetDark: "#7c3aed",
  sky: "#0EA5E9",
  skyLight: "#38bdf8",
  white: "#ffffff",
  muted: "#71717a",
  mutedLight: "#a1a1aa",
  zinc800: "#27272a",
  zinc900: "#18181b",
  green: "#10b981",
  greenLight: "#34d399",
  red: "#ef4444",
  amber: "#f59e0b",
};

export const FONT = '"Inter", system-ui, -apple-system, sans-serif';

export const GRADIENT = `linear-gradient(135deg, ${C.violet}, ${C.sky})`;

// Scene timing: { from, duration } in frames
export const SCENES = {
  intro:      { from: 0,    duration: 300 },  // 0–10s
  problem:    { from: 300,  duration: 300 },  // 10–20s
  solution:   { from: 600,  duration: 300 },  // 20–30s
  upload:     { from: 900,  duration: 450 },  // 30–45s
  details:    { from: 1350, duration: 450 },  // 45–60s
  aiGen:      { from: 1800, duration: 450 },  // 60–75s
  results:    { from: 2250, duration: 600 },  // 75–95s
  customize:  { from: 2850, duration: 300 },  // 95–105s
  cta:        { from: 3150, duration: 450 },  // 105–120s
};
