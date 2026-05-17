import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { extractLinkedFields, getLinkScope, isLinkedSibling } from "@/domain/group/linking";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
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

// -- extractLinkedFields ------------------------------------------------------

describe("extractLinkedFields", () => {
  it("propagates text, agentId, and backgroundText when present", () => {
    expect(extractLinkedFields({ text: "Hi", agentId: "v2", backgroundText: "ah" })).toEqual({
      text: "Hi",
      agentId: "v2",
      backgroundText: "ah",
    });
  });

  it("ignores fields absent from the update", () => {
    expect(extractLinkedFields({ text: "Hi" })).toEqual({ text: "Hi" });
  });

  it("propagates an explicit clear of words, begin, end, and backgroundWords", () => {
    expect(
      extractLinkedFields({ words: undefined, begin: undefined, end: undefined, backgroundWords: undefined }),
    ).toEqual({ words: undefined, begin: undefined, end: undefined, backgroundWords: undefined });
  });

  it("does not propagate a words update carrying a defined value", () => {
    expect(extractLinkedFields({ words: [{ text: "a", begin: 0, end: 1 }] })).toEqual({});
  });

  it("does not propagate a begin/end update carrying a defined value", () => {
    expect(extractLinkedFields({ begin: 5, end: 9 })).toEqual({});
  });
});
