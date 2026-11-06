import { it } from "vitest";
import { readWatermark, watermarkLines } from "@/domain/alignment/watermark";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { countOf, paragraphBodies, randomLine, Report, Rng, ttmlOf } from "@/zz-fuzz-lib";

const toMs = (seconds: number) => Math.round(seconds * 1000);
const EPS = 1e-9;

function exportedSpanCountCopy(line: LyricLine): number {
  const main = line.words?.length ?? 0;
  const background = line.backgroundText ? Math.max(line.backgroundWords?.length ?? 0, 1) : 0;
  return main + background;
}

function trackViolations(before: readonly WordTiming[], after: readonly WordTiming[]): string[] {
  const issues: string[] = [];
  if (before.length !== after.length) return ["length changed"];
  for (let i = 0; i < before.length; i++) {
    const a = before[i];
    const b = after[i];
    if (Math.abs(b.begin - a.begin) > 0.003 + EPS) issues.push(`w${i} begin moved ${(b.begin - a.begin) * 1000}ms`);
    if (Math.abs(b.end - a.end) > 0.003 + EPS) issues.push(`w${i} end moved ${(b.end - a.end) * 1000}ms`);
    if (a.begin < a.end && !(b.begin < b.end)) issues.push(`w${i} begin>=end`);
    if (b.begin < 0) issues.push(`w${i} negative begin`);
    if (b.text !== a.text) issues.push(`w${i} text changed`);
    if (i > 0) {
      const pa = before[i - 1];
      const pb = after[i - 1];
      if (pa.begin <= a.begin && pb.begin > b.begin) issues.push(`w${i} order flipped`);
      if (pa.end === a.begin && pb.end !== b.begin) issues.push(`w${i} touch broken`);
      if (pa.end <= a.begin && pb.end > b.begin + EPS) issues.push(`w${i} new overlap prev.end=${pb.end} begin=${b.begin}`);
    }
  }
  return issues;
}

function stampViolations(line: LyricLine): string[] {
  const [stamped] = watermarkLines([line], new Set([line.id]));
  const issues = trackViolations(line.words ?? [], stamped.words ?? []).map((s) => `main ${s}`);
  issues.push(...trackViolations(line.backgroundWords ?? [], stamped.backgroundWords ?? []).map((s) => `bg ${s}`));
  for (const key of Object.keys(line) as (keyof LyricLine)[]) {
    if (key !== "words" && key !== "backgroundWords" && stamped[key] !== line[key]) issues.push(`field ${key} changed`);
  }
  return issues;
}

function eligibleCount(words: readonly WordTiming[] | undefined): number {
  return (words ?? []).filter((w) => toMs(w.end) - toMs(w.begin) >= 7).length;
}

function shrinkLine(line: LyricLine, fails: (l: LyricLine) => boolean): LyricLine {
  let current = line;
  let progressed = true;
  while (progressed) {
    progressed = false;
    const candidates: LyricLine[] = [];
    const words = current.words ?? [];
    for (let i = 0; i < words.length && words.length > 1; i++) {
      candidates.push({ ...current, words: words.filter((_, j) => j !== i) } as LyricLine);
    }
    const bg = current.backgroundWords ?? [];
    if (current.backgroundText || bg.length) {
      const { backgroundText, backgroundWords, ...rest } = current;
      candidates.push(rest as LyricLine);
    }
    for (let i = 0; i < bg.length && bg.length > 1; i++) {
      candidates.push({ ...current, backgroundWords: bg.filter((_, j) => j !== i) } as LyricLine);
    }
    const next = candidates.find(fails);
    if (next) {
      current = next;
      progressed = true;
    }
  }
  return current;
}

function compact(line: LyricLine) {
  const t = (ws?: readonly WordTiming[]) => ws?.map((w) => [w.text, w.begin, w.end]);
  return { words: t(line.words), backgroundText: line.backgroundText, backgroundWords: t(line.backgroundWords) };
}

it("fuzz watermark", () => {
  const report = new Report();
  const N = 20000;
  const markCauses: Record<string, number> = {};
  for (let seed = 1; seed <= N; seed++) {
    const rng = new Rng(seed);
    const subMs = seed % 10 === 0;
    const line = randomLine(rng, `l${seed}`, { subMs });
    const property = subMs ? "stamp invariants (sub-ms inputs)" : "stamp invariants (ms-grid inputs)";
    report.count(property);
    const issues = stampViolations(line);
    if (issues.length) {
      const minimal = shrinkLine(line, (l) => stampViolations(l).length > 0);
      report.fail(property, seed, { issues: stampViolations(minimal), minimal: compact(minimal) });
    }

    const other = randomLine(rng, `o${seed}`);
    const [, untouchedOther] = watermarkLines([line, other], new Set([line.id]));
    report.count("lines outside set returned by reference");
    if (untouchedOther !== other) report.fail("lines outside set returned by reference", seed, {});

    if (subMs) continue;
    const [stamped] = watermarkLines([line], new Set([line.id]));
    const reading = readWatermark(ttmlOf([stamped], rng.bool()));
    if (eligibleCount(line.words) + eligibleCount(line.backgroundText ? line.backgroundWords : []) >= 2) {
      report.count("stamped line with >=2 eligible words reads as marked");
      if (reading.markedLines !== 1) {
        const fails = (l: LyricLine) =>
          eligibleCount(l.words) + eligibleCount(l.backgroundText ? l.backgroundWords : []) >= 2 &&
          readWatermark(ttmlOf(watermarkLines([l], new Set([l.id])))).markedLines !== 1;
        const minimal = shrinkLine(line, fails);
        const words = (minimal.words ?? []).length + (minimal.backgroundText ? Math.max(1, minimal.backgroundWords?.length ?? 0) : 0);
        const key = `spans=${words}, ineligible(main)=${(minimal.words ?? []).length - eligibleCount(minimal.words)}`;
        markCauses[key] = (markCauses[key] ?? 0) + 1;
        report.fail("stamped line with >=2 eligible words reads as marked", seed, { minimal: compact(minimal) });
      }
    }
  }
  report.notes.unmarkedMinimalShapes = markCauses;

  for (let seed = 1; seed <= 6000; seed++) {
    const rng = new Rng(seed * 7919);
    const lineSynced = seed % 3 === 0;
    const line = randomLine(rng, `s${seed}`, { lineSynced, backgroundText: rng.bool(0.6), backgroundWords: rng.bool(0.5) });
    for (const timing of ["word", "line"] as const) {
      const property = `exportedSpanCount == <span begin= count (${timing}, ${lineSynced ? "line-synced" : "word-synced"})`;
      const body = paragraphBodies(ttmlOf([line], false, timing))[0];
      if (body === undefined) continue;
      report.count(property);
      const actual = countOf(body, '<span begin="');
      const expected = exportedSpanCountCopy(line);
      if (actual !== expected) {
        report.fail(property, seed, { expected, actual, line: compact(line) });
      }
    }
  }
  report.write("watermark");
});

it("fuzz watermark false positives", () => {
  const report = new Report();
  const rates: Record<number, string> = {};
  for (let words = 2; words <= 10; words++) {
    let marked = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      const rng = new Rng(words * 1000003 + i);
      let cursor = rng.int(1000, 300000);
      const timed: WordTiming[] = [];
      for (let w = 0; w < words; w++) {
        const begin = cursor;
        const end = begin + rng.int(80, 900);
        timed.push({ text: `${rng.pick(["mo", "lun", "fera", "skal", "tine"])}${w < words - 1 ? " " : ""}`, begin: begin / 1000, end: end / 1000 });
        cursor = rng.bool(0.6) ? end : end + rng.int(10, 400);
      }
      const ttml = ttmlOf([{ id: "fp", text: timed.map((t) => t.text).join(""), agentId: "v1", words: timed }]);
      marked += readWatermark(ttml).markedLines;
    }
    rates[words] = `${((marked / trials) * 100).toFixed(3)}% (${marked}/${trials})`;
  }
  report.notes.falsePositiveRateByWordCount = rates;
  report.write("false-positives");
});
