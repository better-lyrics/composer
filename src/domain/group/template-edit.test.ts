/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { LinkGroup } from "@/domain/group/template";
import { carryTemplateEdits } from "@/domain/group/template-edit";
import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { withFields } from "@/test/field-updates";

const ownTiming: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
const shared: LinkGroup = { ...ownTiming, sharesTiming: true };

const groupLine = (id: string, instanceIdx: number, fields: Partial<LineFields>) =>
  lineFromFields({ id, text: "", agentId: "v1", groupId: "g1", instanceIdx, templateLineIdx: 0, ...fields });

const words = (begin: number, texts: readonly string[], step = 0.5) =>
  texts.map((text, index) => ({
    id: `${begin}-${index}`,
    text,
    sep: index < texts.length - 1 ? " " : "",
    begin: begin + index * step,
    end: begin + (index + 1) * step,
    joinsNext: false,
  }));

const spans = (line: LyricLine) => timedSyllables(mainTrack(line)).map((word) => [word.text, word.begin, word.end]);

function carried(before: LyricLine[], after: LyricLine[], groups: LinkGroup[] = [ownTiming]): LyricLine[] {
  return carryTemplateEdits({ before, after, groups }).lines;
}

describe("carryTemplateEdits", () => {
  it("keeps the lines when no group line's content changed", () => {
    const lines = [groupLine("L1", 0, { text: "glow" }), lineFromFields({ id: "L2", text: "plain", agentId: "v1" })];
    const after = lines.with(1, withFields(lines[1], { text: "edited" }));
    expect(carried(lines, after)).toBe(after);
  });

  it("gives a text edit to every other instance of the template line", () => {
    const before = [groupLine("L1", 0, { text: "stale" }), groupLine("L2", 1, { text: "stale" })];
    const after = before.with(0, withFields(before[0], { text: "edited" }));
    const out = carried(before, after);
    expect(out.map(lineText)).toEqual(["edited", "edited"]);
    expect(out[0]).toBe(after[0]);
  });

  it("keeps each instance's own word timing when only a word's text changes", () => {
    const before = [
      groupLine("L1", 0, { text: "I love you", words: words(10, ["I", "love", "you"], 0.4) }),
      groupLine("L2", 1, { text: "I love you", words: words(30, ["I", "love", "you"]) }),
    ];
    const edited = timedSyllables(mainTrack(before[0])).map((word, index) =>
      index === 1 ? { ...word, text: "luv" } : word,
    );
    const after = before.with(0, withFields(before[0], { text: "I luv you", words: edited }));
    expect(spans(carried(before, after)[1])).toEqual([
      ["I", 30, 30.5],
      ["luv", 30.5, 31],
      ["you", 31, 31.5],
    ]);
  });

  it("gives a split to a shared instance on the shared timing", () => {
    const before = [
      groupLine("L1", 0, { text: "lantern", words: words(10, ["lantern"], 1) }),
      groupLine("L2", 1, { text: "lantern", words: words(40, ["lantern"], 1) }),
    ];
    const [lantern] = timedSyllables(mainTrack(before[0]));
    const split = [
      { ...lantern, text: "lan", end: 10.25, joinsNext: true },
      { ...lantern, id: "tern", text: "tern", begin: 10.25 },
    ];
    const after = before.with(0, withFields(before[0], { text: "lan|tern", words: split }));
    expect(spans(carried(before, after, [shared])[1])).toEqual([
      ["lan", 40, 40.25],
      ["tern", 40.25, 41],
    ]);
  });

  it("gives the singer and the background with its source to every other instance, which keeps its own timing", () => {
    const before = [
      groupLine("L1", 0, { text: "Hello", backgroundText: "oh" }),
      groupLine("L2", 1, { text: "Hello", words: words(9, ["Hello"], 1), backgroundText: "oh" }),
    ];
    const after = before.with(
      0,
      withFields(before[0], {
        agentId: "v2",
        backgroundText: "ooh",
        backgroundTextSource: "extraction",
      }),
    );
    const out = carried(before, after)[1];
    expect([lineText(out), mainTrack(out).agentId, backgroundText(out), backgroundTrack(out)?.source]).toEqual([
      "Hello",
      "v2",
      "ooh",
      "extraction",
    ]);
    expect(spans(out)).toEqual([["Hello", 9, 10]]);
  });

  it("regression: a split mark typed in one instance joins the other instance's syllables too", () => {
    const before = [
      groupLine("L1", 0, { text: "hel lo", words: words(0, ["hel", "lo"], 1) }),
      groupLine("L2", 1, { text: "hel lo", words: words(10, ["hel", "lo"], 1) }),
    ];
    const joined = timedSyllables(mainTrack(before[0])).map((word, index) =>
      index === 0 ? { ...word, sep: "", joinsNext: true } : word,
    );
    const after = before.with(0, withFields(before[0], { text: "hel|lo", words: joined }));
    const out = carried(before, after)[1];
    expect(timedSyllables(mainTrack(out)).map((word) => word.joinsNext)).toEqual([true, false]);
    expect(spans(out)).toEqual([
      ["hel", 10, 11],
      ["lo", 11, 12],
    ]);
  });

  it("drops the background from every instance when the edit removes it", () => {
    const withBackground = { text: "main", backgroundText: "ooh", backgroundTextSource: "extraction" as const };
    const before = [groupLine("L1", 0, withBackground), groupLine("L2", 1, withBackground)];
    const after = before.with(0, groupLine("L1", 0, { text: "main" }));
    const out = carried(before, after);
    expect(backgroundText(out[1])).toBeUndefined();
    expect(backgroundTrack(out[1])).toBeUndefined();
  });

  it("leaves detached lines, other groups and other template lines alone", () => {
    const before = [
      groupLine("L1", 0, { text: "stale" }),
      groupLine("L2", 1, { text: "stale", detached: true }),
      lineFromFields({ id: "L3", text: "stale", agentId: "v1", groupId: "g2", instanceIdx: 0, templateLineIdx: 0 }),
      groupLine("L4", 1, { text: "stale", templateLineIdx: 1 }),
    ];
    const after = before.with(0, withFields(before[0], { text: "edited" }));
    expect(carried(before, after).slice(1)).toEqual(before.slice(1));
  });
});

describe("carryTemplateEdits · two instances edited at once", () => {
  it("regression: each edited instance keeps its own edit and the others take the first one", () => {
    const before = [
      groupLine("L0", 0, { text: "stale" }),
      groupLine("L1", 1, { text: "stale" }),
      groupLine("L2", 2, { text: "stale" }),
    ];
    const after = before
      .with(0, withFields(before[0], { text: "first" }))
      .with(2, withFields(before[2], { text: "second" }));
    expect(carried(before, after).map(lineText)).toEqual(["first", "first", "second"]);
  });
});

describe("carryTemplateEdits · syllable ids", () => {
  const ids = (line: LyricLine) => line.tracks.flatMap((track) => track.syllables.map((syllable) => syllable.id));

  it("regression: a copy split differently never takes the edited instance's syllable ids", () => {
    const before = [
      groupLine("L1", 0, { text: "beautiful", words: words(10, ["beau", "ti", "ful"], 0.3) }),
      groupLine("L2", 1, { text: "beautiful", words: words(40, ["be", "aut", "iful"], 0.3) }),
    ];
    const [beau, ti, ful] = timedSyllables(mainTrack(before[0]));
    const merged = [{ ...beau, text: "beauti", end: ti.end }, ful];
    const out = carried(before, before.with(0, withFields(before[0], { text: "beauti|ful", words: merged })));
    expect(ids(out[1]).filter((id) => ids(out[0]).includes(id))).toEqual([]);
  });

  it("regression: an untimed copy that already differed never takes the edited instance's syllable ids", () => {
    const before = [groupLine("L1", 0, { text: "We glow tonight" }), groupLine("L2", 1, { text: "We glow" })];
    const out = carried(before, before.with(0, withFields(before[0], { text: "We glow so bright" })));
    expect(lineText(out[1])).toBe("We glow so bright");
    expect(ids(out[1]).filter((id) => ids(out[0]).includes(id))).toEqual([]);
  });

  it("regression: a split never gives two instances the same new syllable id", () => {
    const before = [
      groupLine("L1", 0, { text: "lantern", words: words(10, ["lantern"], 1) }),
      groupLine("L2", 1, { text: "lantern", words: words(40, ["lantern"], 1) }),
    ];
    const [lantern] = timedSyllables(mainTrack(before[0]));
    const split = [
      { ...lantern, text: "lan", end: 10.25, joinsNext: true },
      { ...lantern, id: "tern", text: "tern", begin: 10.25 },
    ];
    const out = carried(before, before.with(0, withFields(before[0], { text: "lan|tern", words: split })));
    expect(ids(out[1]).filter((id) => ids(out[0]).includes(id))).toEqual([]);
  });
});

describe("carryTemplateEdits · a line-synced edit on a word-synced instance", () => {
  it("regression: retyping a line-synced line keeps another instance's own word timing", () => {
    const before = [
      groupLine("L1", 0, { text: "We glow tonight", begin: 10, end: 12 }),
      groupLine("L2", 1, { text: "We glow tonight", words: words(40, ["We", "glow", "tonight"]) }),
    ];
    for (const text of ["We glow tonight now", "So we glow tonight"]) {
      const out = carried(before, before.with(0, withFields(before[0], { text })))[1];
      expect(lineText(out)).toBe(text);
      expect(spans(out).filter(([word]) => word === "glow" || word === "tonight")).toEqual([
        ["glow", 40.5, 41],
        ["tonight", 41, 41.5],
      ]);
    }
  });
});

describe("carryTemplateEdits · a word added at the front", () => {
  const earlierLine = lineFromFields({ id: "P", text: "Low tide", agentId: "v1", begin: 36, end: 38 });

  it("regression: a line-synced edit puts the new first word in the instance's own room, never back to zero", () => {
    const before = [
      groupLine("L1", 0, { text: "We glow tonight", begin: 10, end: 12 }),
      earlierLine,
      groupLine("L2", 1, { text: "We glow tonight", words: words(40, ["We", "glow", "tonight"]) }),
    ];
    const out = carried(before, before.with(0, withFields(before[0], { text: "So We glow tonight" })))[2];
    const [so] = timedSyllables(mainTrack(out));
    expect(so.text).toBe("So");
    expect(so.begin).toBeGreaterThanOrEqual(38);
    expect(so.end).toBeLessThanOrEqual(40);
  });

  it("regression: a timed new first word keeps its lead before the instance's first word", () => {
    const before = [
      groupLine("L1", 0, { text: "We glow", words: words(10, ["We", "glow"]) }),
      earlierLine,
      groupLine("L2", 1, { text: "We glow", words: words(40, ["We", "glow"]) }),
    ];
    const [we, glow] = timedSyllables(mainTrack(before[0]));
    const added = [{ ...we, id: "so", text: "So", begin: 9.5, end: 10 }, we, glow];
    const out = carried(before, before.with(0, withFields(before[0], { text: "So We glow", words: added })))[2];
    expect(spans(out)[0]).toEqual(["So", 39.5, 40]);
  });
});
