import { describe, expect, it } from "vitest";
import type { Doc } from "./doc";
import type { TemplateLine } from "./group";
import type { LyricLine, Syllable } from "./line";
import { validateDoc } from "./validate-doc";

// -- Fixtures -----------------------------------------------------------------

function syllable(id: string, text: string, begin?: number, end?: number): Syllable {
  const untimed = { id, text, sep: " ", joinsNext: false };
  return begin === undefined || end === undefined ? untimed : { ...untimed, begin, end };
}

function line(id: string, syllables: Syllable[], agentId = "v1"): LyricLine {
  return { id, tracks: [{ id: `${id}-main`, role: "main", agentId, syllables }] };
}

const chorusTemplate: TemplateLine = {
  ...line("chorus-1", [syllable("w1", "Paper", 0, 0.4), syllable("w2", "lanterns", 0.4, 1.1)]),
  slot: 0,
};

function doc(overrides: Partial<Doc> = {}): Doc {
  return {
    body: [
      line("verse-1", [syllable("w1", "Gravel", 1, 1.5), syllable("w2", "roads", 1.5, 2)]),
      { kind: "instance", key: "chorus:0", slots: [0] },
      { kind: "instance", key: "chorus:1", slots: [0] },
    ],
    instances: {
      "chorus:0": { groupId: "chorus", idx: 0, at: 3, lineIds: { 0: "chorus-1" } },
      "chorus:1": { groupId: "chorus", idx: 1, at: 8, lineIds: { 0: "chorus-2" } },
    },
    templates: { chorus: [chorusTemplate] },
    groups: [{ id: "chorus", label: "Chorus", color: "#f472b6", templateVersion: 1, sharesTiming: true }],
    agents: [{ id: "v1", type: "person" }],
    parts: [{ id: "part-1", lineIds: ["verse-1", "chorus-1"] }],
    passthrough: {},
    ...overrides,
  };
}

// -- Tests --------------------------------------------------------------------

describe("validateDoc", () => {
  it("accepts a doc with plain lines and placed instances", () => {
    expect(validateDoc(doc(), { songEnd: 10 })).toEqual({ errors: [], warnings: [] });
  });

  it("reports duplicate ids, a track timed twice and references that do not resolve", () => {
    // The line type rules this out, so the line arrives the way an untyped saved file would bring it.
    const spanned = {
      id: "bridge-1",
      tracks: [
        {
          id: "bridge-1-main",
          role: "main",
          agentId: "v2",
          begin: 4,
          end: 5,
          syllables: [syllable("w1", "Hollow", 4, 5)],
        },
      ],
    } as unknown as LyricLine;
    const report = validateDoc(
      doc({
        body: [
          line("verse-1", [syllable("w1", "Gravel", 1, 1.5), syllable("w1", "roads", 1.5, 2)]),
          line("verse-1", [syllable("w3", "Again")]),
          spanned,
          { kind: "instance", key: "chorus:7", slots: [0] },
        ],
        parts: [{ id: "part-1", lineIds: ["outro-1"] }],
      }),
    );
    expect(report.errors.map(({ node, rule }) => `${node} ${rule}`)).toEqual([
      "line verse-1 duplicate-id",
      "line verse-1 duplicate-line-id",
      "line bridge-1 span-and-syllable-times",
      "line bridge-1 unknown-agent",
      "body chorus:7 unknown-instance",
      "part part-1 unknown-line",
    ]);
  });

  it("keeps imported overlapping and reversed spans as warnings", () => {
    const report = validateDoc(
      doc({
        body: [line("verse-1", [syllable("w1", "Gravel", 1, 1.8), syllable("w2", "roads", 1.5, 1.2)])],
        instances: {},
        parts: [],
      }),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.map(({ rule }) => rule)).toEqual(["begin-after-end", "overlaps-previous"]);
  });

  it("checks flattened instances against the song end only when it is known", () => {
    const late = doc({
      instances: {
        "chorus:0": { groupId: "chorus", idx: 0, at: 3, lineIds: { 0: "chorus-1" } },
        "chorus:1": { groupId: "chorus", idx: 1, at: 9.5, lineIds: { 0: "chorus-2" } },
      },
    });
    expect(validateDoc(late).errors).toEqual([]);
    expect(validateDoc(late, { songEnd: 10 }).errors).toEqual([{ node: "instance chorus:1", rule: "out-of-song" }]);
  });
});
