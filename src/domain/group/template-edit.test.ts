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
