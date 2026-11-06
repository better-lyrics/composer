import { it } from "vitest";
import { readBuildTag, withBuildTag } from "@/domain/alignment/build-tag";
import { coversSpan, type HeardRange, mergeRanges, readHeardRanges, withoutSpans } from "@/domain/alignment/heard-ranges";
import { alignmentBreakdown } from "@/domain/alignment/review-state";
import { timingFingerprint } from "@/domain/alignment/fingerprint";
import { isLineTimed } from "@/domain/line/sync-progress";
import { createLine } from "@/test/factories";
import { countOf, randomLine, Report, Rng, ttmlOf } from "@/zz-fuzz-lib";

const ATTR = ' composer:build="';
const cap = (n: number) => Math.min(Math.max(0, Math.round(n)), 511);

function tagValue(ttml: string): string | undefined {
  const at = ttml.indexOf(ATTR);
  return at < 0 ? undefined : ttml.slice(at + ATTR.length, ttml.indexOf('"', at + ATTR.length));
}

function stripAttr(ttml: string): string {
  const at = ttml.indexOf(ATTR);
  return at < 0 ? ttml : ttml.slice(0, at) + ttml.slice(at + ATTR.length + 9);
}

function randomTtml(rng: Rng): string {
  const lines = Array.from({ length: rng.int(0, 12) }, (_, i) => randomLine(rng, `t${i}`, { lineSynced: rng.bool(0.2) }));
  let ttml = ttmlOf(lines, rng.bool());
  const variant = rng.int(0, 3);
  if (variant === 1) ttml = ttml.replace(' composer:timing="Word"', "").replace(' composer:timing="Line"', "");
  if (variant === 2) ttml = `<tt>${ttml.slice(ttml.indexOf(">") + 1)}`;
  return ttml;
}

it("fuzz build tag", () => {
  const report = new Report();
  let randomAccepted = 0;
  let movedAccepted = 0;
  let movedTrials = 0;
  let sameShapeAccepted = 0;
  let sameShapeTrials = 0;
  const N = 8000;
  for (let seed = 1; seed <= N; seed++) {
    const rng = new Rng(seed);
    const ttml = randomTtml(rng);
    const tag = { untouched: rng.int(0, 600), heard: rng.int(0, 600), fixed: rng.int(0, 600), handSynced: rng.int(0, 600), handEdited: rng.bool() };
    const expected = { untouched: cap(tag.untouched), heard: cap(tag.heard), fixed: cap(tag.fixed), handSynced: cap(tag.handSynced), handEdited: tag.handEdited };
    const tagged = withBuildTag(ttml, tag);
    const value = tagValue(tagged);
    report.count("round trip equals capped tag");
    if (JSON.stringify(readBuildTag(tagged)) !== JSON.stringify(expected)) report.fail("round trip equals capped tag", seed, { tag, read: readBuildTag(tagged), head: ttml.slice(0, 80) });
    report.count("value is 8 base36 chars");
    if (value === undefined || value.length !== 8 || [...value].some((c) => !"0123456789abcdefghijklmnopqrstuvwxyz".includes(c))) report.fail("value is 8 base36 chars", seed, { value });
    report.count("rest of text byte-identical");
    if (stripAttr(tagged) !== ttml) report.fail("rest of text byte-identical", seed, { head: tagged.slice(0, 120) });
    const tag2 = { untouched: rng.int(0, 511), heard: rng.int(0, 511), fixed: rng.int(0, 511), handSynced: rng.int(0, 511), handEdited: rng.bool() };
    const retagged = withBuildTag(tagged, tag2);
    report.count("retag replaces, never duplicates");
    if (countOf(retagged, ATTR) !== 1 || JSON.stringify(readBuildTag(retagged)) !== JSON.stringify(tag2) || stripAttr(retagged) !== ttml) report.fail("retag replaces, never duplicates", seed, { count: countOf(retagged, ATTR) });

    const fake = Array.from({ length: 8 }, () => "0123456789abcdefghijklmnopqrstuvwxyz"[rng.int(0, 35)]).join("");
    if (readBuildTag(tagged.replace(`${ATTR}${value}"`, `${ATTR}${fake}"`)) !== null) randomAccepted++;

    const other = randomTtml(new Rng(seed + 1_000_000));
    const shapeOf = (t: string) => `${countOf(t, "<p ")}:${countOf(t, '<span begin="')}`;
    const moved = withBuildTag(other, tag).replace(`${ATTR}${tagValue(withBuildTag(other, tag))}"`, `${ATTR}${value}"`);
    if (shapeOf(other) === shapeOf(ttml)) {
      sameShapeTrials++;
      if (readBuildTag(moved) !== null) sameShapeAccepted++;
    } else {
      movedTrials++;
      if (readBuildTag(moved) !== null) movedAccepted++;
    }
  }
  report.notes.randomValueAcceptRate = `${((randomAccepted / N) * 100).toFixed(2)}% (${randomAccepted}/${N})`;
  report.notes.wrongSongAcceptRate = `${((movedAccepted / movedTrials) * 100).toFixed(2)}% (${movedAccepted}/${movedTrials})`;
  report.notes.sameShapeOtherSongAcceptRate = `${sameShapeAccepted}/${sameShapeTrials}`;

  const edge: Record<string, unknown> = {};
  const base = ttmlOf([createLine({ id: "e", text: 'say composer:build="abcdefgh" now', begin: 1, end: 2 })]);
  const edgeTagged = withBuildTag(base, { untouched: 1, heard: 0, fixed: 0, handSynced: 0, handEdited: false });
  edge.lyricContainingAttr = { byteIdentical: stripAttr(edgeTagged) === base, lyricKept: edgeTagged.includes('say composer:build="abcdefgh" now'), read: readBuildTag(edgeTagged) };
  edge.selfClosingRoot = withBuildTag("<tt/>", { untouched: 1, heard: 0, fixed: 0, handSynced: 0, handEdited: false });
  edge.noRoot = withBuildTag("<body></body>", { untouched: 1, heard: 0, fixed: 0, handSynced: 0, handEdited: false });
  edge.negativeAndFraction = readBuildTag(withBuildTag(base, { untouched: -5, heard: 2.5, fixed: 1e9, handSynced: Number.NaN, handEdited: true }));
  report.notes.edgeCases = edge;
  report.write("build-tag");
});

function inside(ranges: readonly HeardRange[], p: number): boolean {
  return ranges.some(([a, b]) => a <= p && p <= b);
}

function randomRanges(rng: Rng, n: number): HeardRange[] {
  return Array.from({ length: n }, () => {
    const a = rng.bool(0.5) ? rng.int(0, 100) : rng.next() * 100;
    return [a, a + (rng.bool(0.5) ? rng.int(1, 20) : rng.next() * 20 + 1e-6)] as HeardRange;
  });
}

function randomJson(rng: Rng, depth: number): unknown {
  const atoms = [null, Number.NaN, Number.POSITIVE_INFINITY, -Infinity, "1", "", true, 0, -1, 1e308, undefined, {}, { 0: 1, 1: 2, length: 2 }];
  if (depth > 3 || rng.bool(0.4)) return rng.bool(0.5) ? rng.pick(atoms) : rng.next() * 200 - 50;
  if (rng.bool(0.6)) return Array.from({ length: rng.int(0, 4) }, () => randomJson(rng, depth + 1));
  return { a: randomJson(rng, depth + 1) };
}

it("fuzz heard ranges and breakdown", () => {
  const report = new Report();
  for (let seed = 1; seed <= 20000; seed++) {
    const rng = new Rng(seed);
    const ranges = randomRanges(rng, rng.int(0, 8));
    const merged = mergeRanges(ranges);
    report.count("mergeRanges sorted, disjoint, same union");
    const sorted = merged.every((r, i) => i === 0 || merged[i - 1][1] < r[0]);
    const probes = [...ranges.flat(), ...Array.from({ length: 30 }, () => rng.next() * 130)];
    const sameUnion = probes.every((p) => inside(ranges, p) === inside(merged, p));
    if (!sorted || !sameUnion) report.fail("mergeRanges sorted, disjoint, same union", seed, { ranges, merged });

    const spans = randomRanges(rng, rng.int(0, 4)).map(([begin, end]) => ({ begin, end }));
    const cut = withoutSpans(merged, spans);
    report.count("withoutSpans removes exactly the spans");
    const ok = probes.every((p) => {
      const inSpan = spans.some((s) => s.begin < p && p < s.end);
      const onEdge = spans.some((s) => s.begin === p || s.end === p);
      return onEdge || inside(cut, p) === (inside(merged, p) && !inSpan);
    }) && cut.every(([a, b]) => a < b);
    if (!ok) report.fail("withoutSpans removes exactly the spans", seed, { merged, spans, cut });

    report.count("readHeardRanges never throws, output valid");
    const raw = randomJson(rng, 0);
    try {
      const out = readHeardRanges(raw);
      if (!out.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a < b)) report.fail("readHeardRanges never throws, output valid", seed, { raw: String(raw) });
    } catch (error) {
      report.fail("readHeardRanges never throws, output valid", seed, { error: String(error) });
    }

    const lines = Array.from({ length: rng.int(0, 10) }, (_, i) => {
      const roll = rng.int(0, 3);
      if (roll === 0) return createLine({ id: `b${i}`, text: "quiet ember" });
      return randomLine(rng, `b${i}`, { lineSynced: roll === 1 });
    });
    const aligned: Record<string, string> = {};
    for (const line of lines) {
      const roll = rng.int(0, 2);
      if (roll === 1) aligned[line.id] = timingFingerprint(line);
      if (roll === 2) aligned[line.id] = "stale";
    }
    const { counts, untouchedIds } = alignmentBreakdown(lines, aligned, mergeRanges(randomRanges(rng, rng.int(0, 5)).map(([a, b]) => [a * 4, b * 40] as HeardRange)));
    report.count("alignmentBreakdown invariants");
    const timed = lines.filter(isLineTimed).length;
    if (counts.untouched + counts.fixed + counts.handSynced !== timed || counts.heard > counts.untouched || untouchedIds.size !== counts.untouched) {
      report.fail("alignmentBreakdown invariants", seed, { counts, timed, size: untouchedIds.size });
    }
  }
  report.notes.coversSpanToleranceExample = coversSpan([[10, 20]], 9.6, 20.4);
  report.write("heard");
});
