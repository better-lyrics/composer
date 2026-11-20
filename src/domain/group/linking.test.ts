import { describe, expect, it } from "vitest";
import { getLinkScope, isLinkedSibling, unlinkLines } from "@/domain/group/linking";
import { fieldsOfLine, type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack, timedSyllables } from "@/domain/line/track";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LineFields> = {}): LyricLine {
  return lineFromFields({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- getLinkScope -------------------------------------------------------------

describe("getLinkScope", () => {
  it("returns null for a standalone line", () => {
    expect(getLinkScope(line())).toBeNull();
  });

  it("returns null when only groupId is set", () => {
    expect(getLinkScope(line({ groupId: "g1" }))).toBeNull();
  });

  it("returns null when only templateLineIdx is set", () => {
    expect(getLinkScope(line({ templateLineIdx: 0 }))).toBeNull();
  });

  it("returns null for a detached line even with full link fields", () => {
    expect(getLinkScope(line({ groupId: "g1", templateLineIdx: 0, detached: true }))).toBeNull();
  });

  it("returns the scope for a linked, non-detached line", () => {
    expect(getLinkScope(line({ groupId: "g1", templateLineIdx: 2 }))).toEqual({
      groupId: "g1",
      templateLineIdx: 2,
    });
  });
});

// -- isLinkedSibling ----------------------------------------------------------

describe("isLinkedSibling", () => {
  it("returns false when scope is null", () => {
    expect(isLinkedSibling(line({ groupId: "g1", templateLineIdx: 0 }), null)).toBe(false);
  });

  it("returns true for a line matching the scope", () => {
    expect(isLinkedSibling(line({ groupId: "g1", templateLineIdx: 0 }), { groupId: "g1", templateLineIdx: 0 })).toBe(
      true,
    );
  });

  it("returns false when groupId differs", () => {
    expect(isLinkedSibling(line({ groupId: "g2", templateLineIdx: 0 }), { groupId: "g1", templateLineIdx: 0 })).toBe(
      false,
    );
  });

  it("returns false when templateLineIdx differs", () => {
    expect(isLinkedSibling(line({ groupId: "g1", templateLineIdx: 1 }), { groupId: "g1", templateLineIdx: 0 })).toBe(
      false,
    );
  });

  it("returns false for a detached line inside the scope", () => {
    expect(
      isLinkedSibling(line({ groupId: "g1", templateLineIdx: 0, detached: true }), {
        groupId: "g1",
        templateLineIdx: 0,
      }),
    ).toBe(false);
  });
});

// -- unlinkLines --------------------------------------------------------------

describe("unlinkLines", () => {
  it("clears all four link fields on every matching line", () => {
    const lines = [
      line({ id: "a", groupId: "g1", instanceIdx: 0, templateLineIdx: 0, detached: true }),
      line({ id: "b", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 }),
    ];
    const result = unlinkLines(lines, (l) => l.id === "a");
    expect(fieldsOfLine(result[0])).toMatchObject({ id: "a", text: "Hello" });
    for (const field of ["groupId", "instanceIdx", "templateLineIdx", "detached"] as const) {
      expect(result[0][field]).toBeUndefined();
    }
    expect(result[1]).toBe(lines[1]);
  });

  it("returns the same array when no line matches", () => {
    const lines = [line({ id: "a", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }), line({ id: "b" })];
    expect(unlinkLines(lines, () => false)).toBe(lines);
  });

  it("keeps timing and content on the unlinked line", () => {
    const words = [{ id: "w1", text: "Hello", sep: "", begin: 1, end: 2, joinsNext: false }];
    const lines = [line({ id: "a", groupId: "g1", instanceIdx: 0, templateLineIdx: 0, words })];
    expect(timedSyllables(mainTrack(unlinkLines(lines, () => true)[0]))).toEqual(words);
  });

  it("does not modify its input", () => {
    const lines = [line({ id: "a", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 })];
    const snapshot = structuredClone(lines);
    unlinkLines(lines, () => true);
    expect(lines).toEqual(snapshot);
  });
});
