import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CI guard for frame ownership. A raw `requestAnimationFrame` loop reschedules
// itself forever, so it keeps the main thread busy long after the app goes idle
// (issue #174). `src/lib/frame-loop.ts` is the single scheduler: it runs only
// while something holds it awake, names every subscriber for diagnostics, and
// fault-isolates callbacks. It is therefore the only file allowed to touch the
// platform API.
//
// There is no allowlist. A file that trips this guard has not been migrated
// yet; migrate it rather than exempting it.

// -- Constants ----------------------------------------------------------------

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRAME_LOOP_OWNER = "lib/frame-loop.ts";
const RAW_FRAME_CALL = /\b(request|cancel)AnimationFrame\b/;

// -- Helpers ------------------------------------------------------------------

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      yield* walk(full);
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) yield full;
  }
}

function isTestFile(relPath: string): boolean {
  return relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx") || relPath.endsWith(".browser.test.tsx");
}

function describeOffender(relPath: string, lineNumber: number, call: string): string {
  return [
    `src/${relPath}:${lineNumber} calls ${call} directly.`,
    "Frame scheduling has one owner: src/lib/frame-loop.ts.",
    "  Repeating work each frame -> useFrameLoop(callback, label, enabled)",
    "  A single deferred frame    -> nextFrame(callback)",
    "  Continuous frames during a drag -> holdFrames(label), release on every exit path",
    "A raw loop never stops when the app is idle. See issue #174.",
  ].join("\n");
}

function rawFrameCallers(exemptOwner: boolean): string[] {
  const offenders: string[] = [];

  for (const file of walk(SRC_ROOT)) {
    const relPath = relative(SRC_ROOT, file).replace(/\\/g, "/");
    if (isTestFile(relPath)) continue;
    if (exemptOwner && relPath === FRAME_LOOP_OWNER) continue;

    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const match = RAW_FRAME_CALL.exec(line);
        if (match) offenders.push(describeOffender(relPath, index + 1, `${match[1]}AnimationFrame`));
      });
  }

  return offenders;
}

// -- Tests --------------------------------------------------------------------

describe("frame loop ownership", () => {
  it("detects raw animation frame calls, so the guard cannot silently pass", () => {
    expect(rawFrameCallers(false).join("\n\n")).toContain(`src/${FRAME_LOOP_OWNER}`);
  });

  it("routes every animation frame in src through src/lib/frame-loop.ts", () => {
    expect(rawFrameCallers(true).join("\n\n")).toBe("");
  });
});
