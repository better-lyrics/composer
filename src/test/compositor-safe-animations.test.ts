import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CI guard for compositor-safe animation. Blink can run transform, opacity and
// filter on the compositor thread; everything else forces a style recalc and a
// main-thread paint on every single frame. An infinite animation of an
// uncompositable property therefore burns the main thread forever, even when the
// element is fully transparent or scrolled out of view (issue #174).
//
// `prefers-reduced-motion` is not a mitigation. Measured over CDP emulation it
// removes the paint cost and leaves the frame cost unchanged, so this guard
// deliberately ignores the global `animation-iteration-count: 1` override.
//
// Animations behind a state gate (an attribute selector or a state pseudo-class)
// run only while that state is on, so they are bounded by the interaction that
// turns them on and are out of scope here. Ungated ones run forever.

// -- Types --------------------------------------------------------------------

interface CssDeclaration {
  property: string;
  value: string;
}

interface CssBlock {
  chain: string[];
  keyframesName: string | null;
  declarations: CssDeclaration[];
}

interface InfiniteAnimation {
  keyframesName: string;
  animatedProperties: string[];
}

// -- Constants ----------------------------------------------------------------

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSITABLE = new Set(["transform", "translate", "rotate", "scale", "opacity", "filter", "backdrop-filter"]);
const KEYFRAMES_PRELUDE = /^@(?:-\w+-)?keyframes\s+(\S+)/;
const STATE_GATE = /\[[^\]]+\]|:(?:hover|focus|focus-visible|focus-within|active|checked|disabled|target)\b/;
const VENDOR_PREFIX = /^-\w+-/;

// -- Stylesheet parsing -------------------------------------------------------

function* walkStylesheets(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      yield* walkStylesheets(full);
      continue;
    }
    if (entry.endsWith(".css")) yield full;
  }
}

function toDeclaration(raw: string): CssDeclaration | null {
  const text = raw.trim();
  const colon = text.indexOf(":");
  if (colon <= 0) return null;
  return {
    property: text.slice(0, colon).trim().toLowerCase(),
    value: text
      .slice(colon + 1)
      .trim()
      .toLowerCase(),
  };
}

function parseBlocks(source: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const open: CssBlock[] = [];
  let buffer = "";
  let parenDepth = 0;
  let quote: string | null = null;

  for (const char of source.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (quote) {
      buffer += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth > 0 || (char !== "{" && char !== "}" && char !== ";")) {
      buffer += char;
      continue;
    }

    const parent = open[open.length - 1];
    if (char === "{") {
      const prelude = buffer.trim();
      const named = KEYFRAMES_PRELUDE.exec(prelude);
      const block: CssBlock = {
        chain: [...(parent?.chain ?? []), prelude],
        keyframesName: named ? named[1].toLowerCase() : (parent?.keyframesName ?? null),
        declarations: [],
      };
      open.push(block);
      blocks.push(block);
    } else {
      const declaration = toDeclaration(buffer);
      if (declaration && parent) parent.declarations.push(declaration);
      if (char === "}") open.pop();
    }
    buffer = "";
  }

  return blocks;
}

function allBlocks(): CssBlock[] {
  return [...walkStylesheets(SRC_ROOT)].flatMap((file) => parseBlocks(readFileSync(file, "utf8")));
}

// -- Analysis -----------------------------------------------------------------

function keyframesProperties(blocks: CssBlock[]): Map<string, Set<string>> {
  const byName = new Map<string, Set<string>>();
  for (const block of blocks) {
    if (!block.keyframesName) continue;
    const properties = byName.get(block.keyframesName) ?? new Set<string>();
    for (const declaration of block.declarations) {
      if (declaration.property.startsWith("animation")) continue;
      properties.add(declaration.property.replace(VENDOR_PREFIX, ""));
    }
    byName.set(block.keyframesName, properties);
  }
  return byName;
}

function referencedNames(value: string, known: Map<string, Set<string>>): string[] {
  return value.split(/[\s,]+/).filter((token) => known.has(token));
}

function infiniteNamesIn(block: CssBlock, known: Map<string, Set<string>>): string[] {
  const countIsInfinite = block.declarations.some(
    (declaration) => declaration.property === "animation-iteration-count" && declaration.value.includes("infinite"),
  );
  const names = new Set<string>();

  for (const declaration of block.declarations) {
    if (declaration.property === "animation" && (countIsInfinite || declaration.value.includes("infinite"))) {
      for (const name of referencedNames(declaration.value, known)) names.add(name);
    }
    if (declaration.property === "animation-name" && countIsInfinite) {
      for (const name of referencedNames(declaration.value, known)) names.add(name);
    }
  }

  return [...names];
}

function infiniteAnimations(requireUngated: boolean): InfiniteAnimation[] {
  const blocks = allBlocks();
  const known = keyframesProperties(blocks);
  const found = new Map<string, InfiniteAnimation>();

  for (const block of blocks) {
    if (requireUngated && block.chain.some((prelude) => STATE_GATE.test(prelude))) continue;
    for (const keyframesName of infiniteNamesIn(block, known)) {
      found.set(keyframesName, { keyframesName, animatedProperties: [...(known.get(keyframesName) ?? [])] });
    }
  }

  return [...found.values()];
}

function describeOffender({ keyframesName, animatedProperties }: InfiniteAnimation): string {
  return [
    `@keyframes ${keyframesName} runs infinitely and animates: ${animatedProperties.join(", ")}.`,
    "Only transform / opacity / filter can run on the compositor. Anything else forces",
    "a style recalc and a main-thread paint every frame, forever, even when the element",
    "is invisible. See issue #174.",
  ].join("\n");
}

// -- Tests --------------------------------------------------------------------

describe("compositor safe animations", () => {
  it("resolves the keyframes behind an infinite animation, reduced-motion override notwithstanding", () => {
    const resolved = infiniteAnimations(false);
    expect(resolved.length).toBeGreaterThan(0);
    for (const animation of resolved) expect(animation.animatedProperties.length).toBeGreaterThan(0);
  });

  it("runs every always-on infinite animation on the compositor", () => {
    const offenders = infiniteAnimations(true)
      .filter((animation) => animation.animatedProperties.some((property) => !COMPOSITABLE.has(property)))
      .map(describeOffender);

    expect(offenders.join("\n\n")).toBe("");
  });
});
