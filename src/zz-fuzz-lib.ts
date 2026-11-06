import { mkdirSync, writeFileSync } from "node:fs";
import type { LyricLine } from "@/domain/line/model";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import type { WordTiming } from "@/domain/word/timing";
import { createLine } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";

const OUT_DIR = "/tmp/fuzz-wm";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  next: () => number;
  constructor(public seed: number) {
    this.next = mulberry32(seed);
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

const SYLLABLES = ["lan", "tern", "drift", "har", "bor", "salt", "eve", "ning", "wind", "glass", "riv", "er", "moth", "ember", "quiet", "tide"];

function invent(rng: Rng): string {
  return Array.from({ length: rng.int(1, 3) }, () => rng.pick(SYLLABLES)).join("");
}

interface TrackOptions {
  startMs: number;
  count: number;
  subMs?: boolean;
}

function durationMs(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.1) return 0;
  if (roll < 0.25) return rng.int(1, 6);
  if (roll < 0.35) return rng.int(7, 12);
  return rng.int(13, 3000);
}

function gapMs(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.5) return 0;
  if (roll < 0.7) return rng.int(1, 5);
  return rng.int(6, 600);
}

function randomTrack(rng: Rng, { startMs, count, subMs }: TrackOptions): WordTiming[] {
  const words: WordTiming[] = [];
  let cursor = startMs;
  for (let i = 0; i < count; i++) {
    if (i > 0) cursor += gapMs(rng);
    const begin = cursor;
    const end = begin + durationMs(rng);
    cursor = end;
    const jitter = subMs ? () => rng.int(-4, 4) / 10000 : () => 0;
    words.push({ text: `${invent(rng)}${i < count - 1 ? " " : ""}`, begin: begin / 1000 + jitter(), end: end / 1000 + jitter() });
  }
  return words;
}

function startNear(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.25) return rng.int(0, 12);
  if (roll < 0.4) return rng.int(13, 2000);
  return rng.int(2000, 360000);
}

interface LineShape {
  backgroundText: boolean;
  backgroundWords: boolean;
  lineSynced: boolean;
  subMs: boolean;
}

function randomLine(rng: Rng, id: string, shape?: Partial<LineShape>): LyricLine {
  const start = startNear(rng);
  const words = randomTrack(rng, { startMs: start, count: rng.int(1, 8), subMs: shape?.subMs });
  const text = words.map((word) => word.text).join("");
  const hasBgText = shape?.backgroundText ?? rng.bool(0.4);
  const hasBgWords = hasBgText && (shape?.backgroundWords ?? rng.bool(0.7));
  const bgWords = hasBgWords ? randomTrack(rng, { startMs: start + rng.int(0, 400), count: rng.int(1, 4), subMs: shape?.subMs }) : [];
  if (shape?.lineSynced) {
    return createLine({
      id,
      text,
      begin: start / 1000,
      end: (start + rng.int(1, 5000)) / 1000,
      ...(hasBgText ? { backgroundText: bgWords.map((w) => w.text).join("") || invent(rng) } : {}),
      ...(hasBgWords ? { backgroundWords: bgWords } : {}),
    });
  }
  return createLine({
    id,
    text,
    words,
    ...(hasBgText ? { backgroundText: bgWords.map((w) => w.text).join("") || invent(rng) } : {}),
    ...(hasBgWords ? { backgroundWords: bgWords } : {}),
  });
}

function ttmlOf(lines: LyricLine[], minify = false, timing?: "word" | "line"): string {
  return generateTTML({ metadata: normalizeLoadedMetadata(null), agents: [], lines, minify, timing });
}

function countOf(text: string, part: string): number {
  return text.split(part).length - 1;
}

function paragraphBodies(ttml: string): string[] {
  return ttml
    .split("<p ")
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf("</p>")));
}

interface Finding {
  property: string;
  seed: number;
  detail: unknown;
}

class Report {
  cases = new Map<string, number>();
  failures = new Map<string, Finding[]>();
  notes: Record<string, unknown> = {};
  count(property: string): void {
    this.cases.set(property, (this.cases.get(property) ?? 0) + 1);
    if (!this.failures.has(property)) this.failures.set(property, []);
  }
  fail(property: string, seed: number, detail: unknown): void {
    const list = this.failures.get(property) ?? [];
    list.push({ property, seed, detail });
    this.failures.set(property, list);
  }
  write(name: string): void {
    mkdirSync(OUT_DIR, { recursive: true });
    const summary = [...this.cases.entries()].map(([property, cases]) => {
      const failures = this.failures.get(property) ?? [];
      return { property, cases, failed: failures.length, status: failures.length ? "FAIL" : "PASS", examples: failures.slice(0, 3) };
    });
    writeFileSync(`${OUT_DIR}/${name}.json`, JSON.stringify({ summary, notes: this.notes }, null, 1));
  }
}

export { countOf, invent, paragraphBodies, randomLine, randomTrack, Report, Rng, ttmlOf };
export type { LineShape };
