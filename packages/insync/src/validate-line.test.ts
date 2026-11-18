import { describe, expect, it } from "vitest";
import type { SavedLine, SavedSyllable, SavedTrack } from "./saved-line";
import type { Ms } from "./time";
import { validateLine } from "./validate-line";

function syllable(id: string, text: string, begin?: number, end?: number): SavedSyllable {
  return { id, text, sep: " ", ...(begin !== undefined && end !== undefined && { span: [begin as Ms, end as Ms] }) };
}

function track(role: SavedTrack["role"], syllables: SavedSyllable[], span?: [number, number]): SavedTrack {
  return { id: role, role, syllables, ...(span && { span: span as [Ms, Ms] }) };
}

function line(tracks: SavedTrack[]): SavedLine {
  return { id: "line-1", tracks };
}

describe("validateLine", () => {
  it("accepts a line with a timed main track and a line-synced background", () => {
    const valid = line([
      track("main", [syllable("a", "Paper", 1000, 1600), syllable("b", "lanterns")]),
      track("bg", [syllable("c", "drifting")], [1600, 2200]),
    ]);
    expect(validateLine(valid)).toEqual({ errors: [], warnings: [] });
  });

  it("refuses a track timed both by a span and by its syllables", () => {
    const report = validateLine(line([track("main", [syllable("a", "Paper", 1000, 1600)], [1000, 1600])]));
    expect(report.errors).toEqual([{ track: 0, rule: "span-and-syllable-times" }]);
  });

  it("refuses ids used twice in one line and tracks out of order", () => {
    const report = validateLine(
      line([track("bg", [syllable("a", "drifting")]), track("main", [syllable("a", "Paper")])]),
    );
    expect(report.errors).toEqual([
      { track: 1, syllable: 0, rule: "duplicate-id" },
      { track: 0, rule: "track-order" },
      { track: 1, rule: "track-order" },
    ]);
  });

  it("refuses times that are not finite", () => {
    const report = validateLine(line([track("main", [syllable("a", "Paper")], [Number.NaN, 2000])]));
    expect(report.errors).toEqual([{ track: 0, rule: "non-finite-time" }]);
  });

  it("refuses a track span that starts below zero and warns on one that ends before it begins, as the doc check does", () => {
    const report = validateLine(
      line([track("main", [syllable("a", "Paper")], [-5, 2000]), track("bg", [syllable("b", "glow")], [3000, 2000])]),
    );
    expect(report).toEqual({
      errors: [{ track: 0, rule: "negative-begin" }],
      warnings: [{ track: 1, rule: "begin-after-end" }],
    });
  });

  it("reports syllable spans out of order as a warning, never an error", () => {
    const report = validateLine(
      line([track("main", [syllable("a", "Paper", 1000, 1600), syllable("b", "lanterns", 1200, 1800)])]),
    );
    expect(report).toEqual({ errors: [], warnings: [{ track: 0, syllable: 1, rule: "overlaps-previous" }] });
  });
});
