import { describe, expect, it } from "vitest";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { BACKGROUND_VOCALS } from "@/best-practices/rules/background-vocals";
import { LINES_AND_TEXT } from "@/best-practices/rules/lines-and-text";
import { SYLLABLES } from "@/best-practices/rules/syllables";
import { TIMING } from "@/best-practices/rules/timing";
import { VOICES } from "@/best-practices/rules/voices";
import { expectCleanRuleCopy } from "@/test/copy-guards";
import { SLUG } from "@/test/rule-fixtures";

// -- Registry ------------------------------------------------------------------

describe("BEST_PRACTICE_GROUPS", () => {
  it("orders the five groups", () => {
    expect(BEST_PRACTICE_GROUPS.map((g) => g.id)).toEqual([
      "lines-and-text",
      "background-vocals",
      "voices",
      "syllables",
      "timing",
    ]);
  });

  it("holds seventeen rules in total", () => {
    expect(BEST_PRACTICE_GROUPS.flatMap((g) => g.rules)).toHaveLength(17);
  });

  it("gives every rule a unique id", () => {
    const ids = BEST_PRACTICE_GROUPS.flatMap((g) => g.rules).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("labels the groups in the same reading order", () => {
    expect(BEST_PRACTICE_GROUPS.map((group) => group.label)).toEqual([
      "Lines and text",
      "Background vocals",
      "Voices",
      "Syllables",
      "Timing",
    ]);
  });

  it("holds the rule counts each group was written with", () => {
    expect(BEST_PRACTICE_GROUPS.map((group) => group.rules.length)).toEqual([3, 6, 4, 2, 2]);
  });

  it("registers the group objects the rule modules export, not copies of them", () => {
    expect(BEST_PRACTICE_GROUPS).toEqual([LINES_AND_TEXT, BACKGROUND_VOCALS, VOICES, SYLLABLES, TIMING]);
    for (const [index, group] of [LINES_AND_TEXT, BACKGROUND_VOCALS, VOICES, SYLLABLES, TIMING].entries()) {
      expect(BEST_PRACTICE_GROUPS[index]).toBe(group);
    }
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("BEST_PRACTICE_GROUPS edge cases", () => {
  it("holds no empty group", () => {
    for (const group of BEST_PRACTICE_GROUPS) expect(group.rules.length).toBeGreaterThan(0);
  });

  it("gives every rule a title and at least one body paragraph", () => {
    for (const rule of BEST_PRACTICE_GROUPS.flatMap((group) => group.rules)) {
      expect(rule.title.trim().length).toBeGreaterThan(0);
      expect(rule.body.length).toBeGreaterThan(0);
    }
  });

  it("gives every group a non-empty label", () => {
    for (const group of BEST_PRACTICE_GROUPS) expect(group.label.trim().length).toBeGreaterThan(0);
  });

  it("carries no numbering prefix on any group label", () => {
    for (const group of BEST_PRACTICE_GROUPS) expect(group.label).not.toMatch(/^\d/);
  });
});

// -- Invariants ----------------------------------------------------------------

describe("BEST_PRACTICE_GROUPS invariants", () => {
  it("gives every group a unique id and a unique label", () => {
    const ids = BEST_PRACTICE_GROUPS.map((group) => group.id);
    const labels = BEST_PRACTICE_GROUPS.map((group) => group.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("uses lower case slug ids for groups and rules alike", () => {
    for (const group of BEST_PRACTICE_GROUPS) {
      expect(group.id).toMatch(SLUG);
      for (const rule of group.rules) expect(rule.id).toMatch(SLUG);
    }
  });

  it("reads the same on every access", () => {
    expect(BEST_PRACTICE_GROUPS).toBe(BEST_PRACTICE_GROUPS);
    expect(BEST_PRACTICE_GROUPS.map((group) => group.id)).toEqual(BEST_PRACTICE_GROUPS.map((group) => group.id));
  });

  it("keeps the copy of every group free of forbidden punctuation", () => {
    for (const group of BEST_PRACTICE_GROUPS) expectCleanRuleCopy(group);
  });

  it("starts every rule title with a capital and ends it without a full stop", () => {
    for (const rule of BEST_PRACTICE_GROUPS.flatMap((group) => group.rules)) {
      expect(rule.title[0]).toBe(rule.title[0]?.toUpperCase());
      expect(rule.title.endsWith(".")).toBe(false);
    }
  });
});
