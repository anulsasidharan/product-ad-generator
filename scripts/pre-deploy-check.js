#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage", "test-results", "playwright-report"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const OPTIONAL_ENV_VARS = new Set(["OPENAI_API_KEY", "UPSTASH_REDIS_URL", "UPSTASH_REDIS_TOKEN"]);

function run(command, options = {}) {
  return execSync(command, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...options,
  });
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function parseEnvExample(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  return src
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]?.trim())
    .filter(Boolean);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const out = {};
  const src = fs.readFileSync(filePath, "utf8");
  for (const rawLine of src.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function isPlaceholderValue(value) {
  if (!value) {
    return true;
  }
  const normalized = value.toLowerCase();
  return (
    normalized.includes("your_key_here") ||
    normalized.includes("your_token_here") ||
    normalized.includes("your_url_here") ||
    normalized.includes("vercel_blob_your_token_here") ||
    normalized.includes("sk-ant-api03-your_key_here") ||
    normalized.includes("r8_your_token_here")
  );
}

function checkEnvVars(results) {
  const required = parseEnvExample(path.join(ROOT, ".env.example"));
  const localEnv = parseEnvFile(path.join(ROOT, ".env.local"));
  const fallbackEnv = parseEnvFile(path.join(ROOT, ".env"));
  const missing = required.filter((key) => {
    if (OPTIONAL_ENV_VARS.has(key)) {
      return false;
    }
    const value = process.env[key] || localEnv[key] || fallbackEnv[key] || "";
    return isPlaceholderValue(value);
  });
  if (missing.length > 0) {
    results.fail.push(`Missing or placeholder environment variables: ${missing.join(", ")}`);
    return;
  }
  results.pass.push("Environment variables from .env.example are configured");
}

function checkCommand(name, command, results) {
  try {
    run(command, { stdio: "pipe" });
    results.pass.push(`${name} passed`);
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : "";
    const stdout = error && error.stdout ? String(error.stdout).trim() : "";
    results.fail.push(`${name} failed\n${stderr || stdout}`);
  }
}

function parseKbValues(text) {
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*kB/giu)];
  return matches.map((m) => Number(m[1]));
}

function checkBundleSize(results, maxKb = 500) {
  try {
    const output = run("npm run build");
    const values = parseKbValues(output);
    if (values.length === 0) {
      results.fail.push("Bundle size check failed: could not parse kB values from build output");
      return;
    }
    const largest = Math.max(...values);
    if (largest > maxKb) {
      results.fail.push(`Bundle size too large: ${largest}kB exceeds ${maxKb}kB limit`);
      return;
    }
    results.pass.push(`Bundle size check passed (largest parsed chunk: ${largest}kB)`);
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : "";
    const stdout = error && error.stdout ? String(error.stdout).trim() : "";
    results.fail.push(`Build failed during bundle size check\n${stderr || stdout}`);
  }
}

function checkConsoleLogs(results) {
  const files = walk(ROOT).filter((file) => CODE_EXTENSIONS.has(path.extname(file)));
  const offenders = [];
  for (const file of files) {
    const relative = rel(file);
    if (
      relative.startsWith("scripts/") ||
      relative.startsWith("e2e/") ||
      relative.includes("__tests__/") ||
      relative.endsWith(".test.ts")
    ) {
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (/\bconsole\.log\s*\(/u.test(content)) {
      offenders.push(relative);
    }
  }
  if (offenders.length > 0) {
    results.fail.push(`Found console.log statements in production code: ${offenders.join(", ")}`);
    return;
  }
  results.pass.push("No console.log statements found in production code");
}

function checkHardcodedApiKeys(results) {
  const files = walk(ROOT).filter((file) => CODE_EXTENSIONS.has(path.extname(file)));
  const offenders = [];
  const keyPatterns = [
    /sk-[A-Za-z0-9]{20,}/u,
    /r8_[A-Za-z0-9]{20,}/u,
    /vercel_blob_[A-Za-z0-9_-]{10,}/u,
  ];
  for (const file of files) {
    const relative = rel(file);
    if (
      relative.endsWith(".test.ts") ||
      relative.includes("__tests__/") ||
      relative.startsWith("e2e/") ||
      relative.startsWith("scripts/")
    ) {
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (keyPatterns.some((pattern) => pattern.test(content))) {
      offenders.push(relative);
    }
  }
  if (offenders.length > 0) {
    results.fail.push(`Potential hardcoded API secrets found in: ${offenders.join(", ")}`);
    return;
  }
  results.pass.push("No hardcoded API key patterns found");
}

function checkRateLimiting(results) {
  const requiredFiles = [
    path.join(ROOT, "app/api/analyze/route.ts"),
    path.join(ROOT, "app/api/generate/route.ts"),
    path.join(ROOT, "app/api/iterate/route.ts"),
    path.join(ROOT, "app/api/upload/route.ts"),
  ];
  const missing = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missing.push(rel(file));
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (!content.includes("checkRateLimit(")) {
      missing.push(rel(file));
    }
  }
  if (missing.length > 0) {
    results.fail.push(`Rate limiting not detected in: ${missing.join(", ")}`);
    return;
  }
  results.pass.push("Rate limiting checks detected in all API routes");
}

function checkUploadLimit(results) {
  const uploadRoute = path.join(ROOT, "app/api/upload/route.ts");
  if (!fs.existsSync(uploadRoute)) {
    results.fail.push("Upload route not found at app/api/upload/route.ts");
    return;
  }
  const content = fs.readFileSync(uploadRoute, "utf8");
  if (!content.includes("MAX_BYTES") || !/10\s*\*\s*1024\s*\*\s*1024/u.test(content)) {
    results.fail.push("Image upload size limit not set to 10MB in upload route");
    return;
  }
  results.pass.push("Image upload size limit (10MB) detected");
}

function printResults(results) {
  console.log("=== Pre-Deploy Check Results ===");
  for (const item of results.pass) {
    console.log(`PASS: ${item}`);
  }
  for (const item of results.fail) {
    console.error(`FAIL: ${item}`);
  }
  console.log(`\nSummary: ${results.pass.length} passed, ${results.fail.length} failed`);
}

function main() {
  const results = { pass: [], fail: [] };

  checkEnvVars(results);
  checkCommand("TypeScript check", "npm run type-check", results);
  checkCommand("Unit/Integration tests", "npm run test", results);
  checkBundleSize(results, 500);
  checkConsoleLogs(results);
  checkHardcodedApiKeys(results);
  checkRateLimiting(results);
  checkUploadLimit(results);

  printResults(results);
  if (results.fail.length > 0) {
    process.exit(1);
  }
}

main();
