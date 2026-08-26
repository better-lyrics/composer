import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CI guard for wake completeness. `wireFrameLoop` gates every animation frame in
// the app, so a Zustand store it does not subscribe to produces a surface that
// never repaints until something unrelated wakes the loop. Enumerating the
// stores from disk is what stops that from being a silent omission.

// -- Constants ----------------------------------------------------------------

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIRING_PATH = join(SRC_ROOT, "lib", "frame-loop-wiring.ts");
const STORE_DECLARATION = /\bconst (use[A-Za-z]*Store) = create[<(]/g;

// -- Helpers ------------------------------------------------------------------

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (entry.endsWith(".ts") && !entry.includes(".test.")) yield full;
  }
}

function declaredStoreHooks(): string[] {
  const found = new Set<string>();
  for (const file of walk(SRC_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(STORE_DECLARATION)) found.add(match[1]);
  }
  return [...found].toSorted();
}

// -- Tests --------------------------------------------------------------------

describe("frame loop wake completeness", () => {
  it("finds the app's Zustand stores on disk", () => {
    expect(declaredStoreHooks().length).toBeGreaterThan(10);
  });

  it("subscribes wireFrameLoop to every Zustand store in the app", () => {
    const wiring = readFileSync(WIRING_PATH, "utf8");
    const unwired = declaredStoreHooks().filter((storeHook) => !wiring.includes(`${storeHook}.subscribe(`));
    expect(unwired).toEqual([]);
  });
});
