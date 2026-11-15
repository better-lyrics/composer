import { describe, expect, it } from "vitest";
import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { roleWords } from "@/domain/line/track";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";
import { updatedLine } from "@/test/field-updates";
import { extractInlineAcrossLinkedLines } from "@/utils/background-vocal-extraction";

const OPTIONS = { mergeStandaloneLines: false, preserveBrackets: false };

function wordsAt(texts: string[], begin: number, end: number): WordTiming[] {
  const step = (end - begin) / texts.length;
  return texts.map((text, i) => ({
    id: newWordId(),
    text,
    sep: i < texts.length - 1 ? " " : "",
    joinsNext: false,
    begin: begin + i * step,
    end: begin + (i + 1) * step,
  }));
}

function linkedLine(
  id: string,
  instanceIdx: number,
  timing: { words: WordTiming[] } | { begin: number; end: number; detached?: boolean },
): LyricLine {
  return lineFromFields({
    id,
    text: "hold me (ooh yeah)",
    agentId: "v1",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    ...timing,
  });
}

describe("extractInlineAcrossLinkedLines", () => {
  it("regression: each linked copy keeps the timing of its own bracketed words", () => {
    const lines = [
      linkedLine("a0", 0, { words: wordsAt(["hold", "me", "(ooh", "yeah)"], 10, 14) }),
      linkedLine("a1", 1, { begin: 60, end: 63 }),
      linkedLine("a2", 2, { words: wordsAt(["hold", "me", "(ooh", "yeah)"], 110, 112) }),
      linkedLine("a3", 3, { begin: 150, end: 153, detached: true }),
    ];

    const updates = extractInlineAcrossLinkedLines(lines, "a0", OPTIONS);
    const byId = new Map(updates.map((update) => [update.id, update.updates]));

    expect([...byId.keys()]).toEqual(["a0", "a1", "a2"]);
    for (const update of byId.values()) {
      expect(lineText(updatedLine(update)!)).toBe("hold me");
      expect(backgroundText(updatedLine(update))).toBe("ooh yeah");
    }
    expect(roleWords(updatedLine(byId.get("a2")), "bg")?.map((w) => [w.begin, w.end])).toEqual([
      [111, 111.5],
      [111.5, 112],
    ]);
    const lineSynced = roleWords(updatedLine(byId.get("a1")), "bg") ?? [];
    expect(lineSynced.length).toBe(2);
    expect(lineSynced[0].begin).toBeGreaterThanOrEqual(60);
    expect(lineSynced.at(-1)?.end).toBeLessThanOrEqual(63);
  });

  it("regression: refuses the whole linked edit when one copy cannot extract its own words", () => {
    const lines: LyricLine[] = [
      lineFromFields({ ...fieldsOfLine(linkedLine("a0", 0, { begin: 10, end: 12 })), text: "Hello(ooh) world" }),
      lineFromFields({
        ...fieldsOfLine(linkedLine("a1", 1, { words: wordsAt(["Hello(ooh)", "world"], 60, 62) })),
        text: "Hello(ooh) world",
      }),
    ];

    expect(extractInlineAcrossLinkedLines(lines, "a0", OPTIONS)).toEqual([]);
  });
});
