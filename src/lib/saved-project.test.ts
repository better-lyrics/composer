import { msFromSeconds } from "insync/time";
import { describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "insync/agent-colors";
import { timingFingerprint, v3TimingFingerprint } from "@/domain/alignment/fingerprint";
import { roleWords } from "insync/line-track";
import {
  linesFromLink,
  linesFromSaved,
  SAVED_PROJECT_VERSION,
  type SavedProject,
  type SavedProjectV3,
  savedLines,
  savedLinesForLink,
  upgradeSavedProject,
} from "@/lib/saved-project";
import { linesFromSavedV3, type SavedLineV3 } from "@/lib/saved-project-v3";
import { withPositionIds, withTimesInWholeMs } from "@/test/saved-format-equality";

// -- Fixtures -----------------------------------------------------------------

const V3_LINES: SavedLineV3[] = [
  {
    id: "L1",
    text: "Paper lanterns",
    agentId: "v1",
    words: [
      { text: "Pa", begin: 1.2345, end: 1.4, transliteration: "pē", transliterationJoinerAfter: "" },
      { text: "per ", begin: 1.4, end: 1.6, transliteration: "pā" },
      { text: "lanterns", begin: 1.6, end: 2.2004, explicit: true, transliteration: "rantan" },
    ],
    backgroundText: "drifting",
    backgroundWords: [{ text: "drifting", begin: 2.2, end: 2.9 }],
    backgroundTextSource: "manual",
    translations: { fr: { language: "fr", text: "Lanternes", origin: "manual", sourceFingerprint: "a" } },
    transliteration: {
      language: "ja-Latn",
      text: "pēpā rantan",
      alignmentStatus: "confirmed",
      origin: "manual",
      sourceFingerprint: "a",
    },
  },
  { id: "L2", text: "hel|lo you", agentId: "v2", words: [{ text: "hel", begin: 3, end: 3.3 }] },
  { id: "L3", text: "Waiting in a car", agentId: "v1", begin: 4.0006, end: 5.5 },
  { id: "L4", text: "Not synced yet", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
];

function v3Record(lines: SavedLineV3[] = V3_LINES, version: SavedProjectV3["version"] = 3): SavedProjectV3 {
  return {
    version,
    savedAt: 1,
    metadata: { title: "Lanterns", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    granularity: "word",
    lines,
  };
}

// -- Tests --------------------------------------------------------------------

describe("upgradeSavedProject", () => {
  it("a v3 record upgrades to v4 and loads to the same lines", () => {
    const loadedV3 = linesFromSavedV3(V3_LINES);
    const upgraded = upgradeSavedProject(structuredClone(v3Record()));
    expect(upgraded.version).toBe(4);
    expect(withPositionIds(linesFromSaved(upgraded.lines))).toEqual(withPositionIds(withTimesInWholeMs(loadedV3)));
  });

  it("re-keys an aligned line's fingerprint to its v4 timing and leaves an edited one as it was", () => {
    const loadedV3 = linesFromSavedV3(V3_LINES);
    const record = { ...v3Record(), alignedTimings: { L1: v3TimingFingerprint(loadedV3[0]), L2: "edited" } };
    const upgraded = upgradeSavedProject(record);
    const loaded = linesFromSaved(upgraded.lines);
    expect(upgraded.alignedTimings).toEqual({ L1: timingFingerprint(loaded[0]), L2: "edited" });
  });

  it("upgrades a version 1 record: transliterations migrate and the version becomes current", () => {
    const legacy = v3Record(
      [
        {
          id: "L1",
          text: "걸음은 Like a dance",
          agentId: "v1",
          transliteration: {
            language: "ko-Latn",
            text: "geol-eum-eun Like a dance",
            segments: [],
            origin: "google",
            sourceFingerprint: "legacy",
          },
        },
      ],
      1,
    );
    const upgraded = upgradeSavedProject(legacy);
    expect(upgraded.version).toBe(SAVED_PROJECT_VERSION);
    const romanization = upgraded.lines[0].languages?.transliteration;
    expect(romanization?.main.text).toBe("geol eum eun  Like  a  dance");
    expect(romanization?.main.alignmentStatus).toBe("inferred");
  });

  it("leaves a current record as it is", () => {
    const current = upgradeSavedProject(v3Record());
    expect(upgradeSavedProject(current)).toBe(current);
  });

  it("leaves a malformed record whose lines are not an array as it was stored", () => {
    const project = { ...v3Record(), lines: undefined } as unknown as SavedProjectV3;
    expect(upgradeSavedProject(project)).toBe(project);
    expect(project.version).toBe(3);
  });

  it("refuses a record from a newer Composer", () => {
    const newer = { ...upgradeSavedProject(v3Record()), version: SAVED_PROJECT_VERSION + 1 } as unknown as SavedProject;
    expect(() => upgradeSavedProject(newer)).toThrow(/Unsupported project version: 5/);
  });

  it("keeps every line id of the v3 record, so each open of an unsaved upgrade names the same lines", () => {
    const ids = V3_LINES.map((line) => line.id);
    expect(linesFromSaved(upgradeSavedProject(v3Record()).lines).map((line) => line.id)).toEqual(ids);
    expect(linesFromSaved(upgradeSavedProject(v3Record()).lines).map((line) => line.id)).toEqual(ids);
  });
});

describe("format 4 lines", () => {
  it("a v4 save and load keeps every line", () => {
    const lines = linesFromSaved(savedLines(linesFromSavedV3(V3_LINES)));
    expect(linesFromSaved(savedLines(lines))).toEqual(lines);
  });

  it("regression: a line aligned at a half-millisecond time stays aligned after a save and load", () => {
    const [line] = linesFromSavedV3([
      { id: "L1", text: "Paper", agentId: "v1", words: [{ text: "Paper", begin: 1.2345, end: 1.6 }] },
    ]);
    const [reloaded] = linesFromSaved(savedLines([line]));
    expect(timingFingerprint(reloaded)).toBe(timingFingerprint(line));
  });

  it("regression: a saved track writes its singer and span before its syllables", () => {
    const [main] = savedLines(linesFromSavedV3([{ id: "L1", text: "Paper", agentId: "v1", begin: 1, end: 2 }]))[0]
      .tracks;
    expect(Object.keys(main)).toEqual(["id", "role", "agent", "span", "syllables"]);
  });

  it("records keep syllable ids and a link leaves them out", () => {
    const lines = linesFromSavedV3(V3_LINES);
    const ids = roleWords(lines[0], "main")?.map((word) => word.id);
    expect(roleWords(linesFromSaved(savedLines(lines))[0], "main")?.map((word) => word.id)).toEqual(ids);
    expect(JSON.stringify(savedLinesForLink(lines))).not.toContain('"id":"L1:main"');
    expect(savedLinesForLink(lines)[0].tracks[0].syllables.every((syllable) => syllable.id === undefined)).toBe(true);
  });

  it("a link made before format 4 and a format 4 link open the same lines", () => {
    const fromV3Link = linesFromLink({ lines: V3_LINES });
    const fromV4Link = linesFromLink({ version: SAVED_PROJECT_VERSION, lines: savedLinesForLink(fromV3Link) });
    expect(withPositionIds(fromV4Link)).toEqual(withPositionIds(withTimesInWholeMs(fromV3Link)));
  });

  it("gives a loaded syllable a new id when its id is missing or already taken in the track", () => {
    const saved: SavedProject["lines"] = [
      {
        id: "L1",
        tracks: [
          {
            role: "main",
            agent: "v1",
            syllables: [
              { id: "x", text: "Paper", sep: " ", span: [msFromSeconds(1), msFromSeconds(1.6)] },
              { id: "x", text: "lanterns", sep: "", span: [msFromSeconds(1.6), msFromSeconds(2.2)] },
              { text: "glow", sep: "" },
            ],
          },
        ],
      },
    ];
    const ids = linesFromSaved(saved)[0].tracks[0].syllables.map((syllable) => syllable.id);
    expect(ids[0]).toBe("x");
    expect(new Set(ids).size).toBe(3);
  });
});
