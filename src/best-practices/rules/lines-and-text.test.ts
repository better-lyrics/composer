import { describe, expect, it } from "vitest";
import { LINES_AND_TEXT } from "@/best-practices/rules/lines-and-text";
import { expectCleanRuleCopy } from "@/test/copy-guards";
import { markup, ruleById, SLUG, withExample } from "@/test/rule-fixtures";

// -- Group ---------------------------------------------------------------------

describe("LINES_AND_TEXT", () => {
  it("is labelled for the group index", () => {
    expect(LINES_AND_TEXT.label).toBe("Lines and text");
  });

  it("is identified by its slug", () => {
    expect(LINES_AND_TEXT.id).toBe("lines-and-text");
  });

  it("holds the three line and text rules in order", () => {
    expect(LINES_AND_TEXT.rules.map((r) => r.id)).toEqual([
      "one-breath-per-line",
      "sentence-case",
      "empty-instrumental",
    ]);
  });

  it("gives every rule a title and at least one body paragraph", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.body.length).toBeGreaterThan(0);
    }
  });

  it("uses no forbidden punctuation in the copy", () => {
    expectCleanRuleCopy(LINES_AND_TEXT);
  });

  it("carries the paragraph counts the cards were written for", () => {
    expect(ruleById(LINES_AND_TEXT, "one-breath-per-line").body).toHaveLength(2);
    expect(ruleById(LINES_AND_TEXT, "sentence-case").body).toHaveLength(1);
    expect(ruleById(LINES_AND_TEXT, "empty-instrumental").body).toHaveLength(2);
  });

  it("puts an aside on the sentence case rule alone", () => {
    expect(ruleById(LINES_AND_TEXT, "sentence-case").aside).toBeDefined();
    expect(ruleById(LINES_AND_TEXT, "one-breath-per-line").aside).toBeUndefined();
    expect(ruleById(LINES_AND_TEXT, "empty-instrumental").aside).toBeUndefined();
  });
});

// -- Example copy --------------------------------------------------------------

describe("LINES_AND_TEXT examples", () => {
  it("contrasts the run-on line against the two split lines", () => {
    const example = withExample(ruleById(LINES_AND_TEXT, "one-breath-per-line"));
    expect(markup(example.wrong)).toContain("I've been waiting for you all night, where did you go, my love?");
    expect(markup(example.right)).toContain("I've been waiting for you all night");
    expect(markup(example.right)).toContain("Where did you go, my love?");
  });

  it("keeps the deliberate shouted line in the sentence case counter-example", () => {
    const example = withExample(ruleById(LINES_AND_TEXT, "sentence-case"));
    expect(markup(example.wrong)).toContain("WHERE DID YOU GO, MY LOVE.");
    expect(markup(example.wrong)).toContain("i cant stop.");
    expect(markup(example.right)).not.toContain("WHERE DID YOU GO, MY LOVE.");
  });

  it("shows the corrected sentence case lines", () => {
    const example = withExample(ruleById(LINES_AND_TEXT, "sentence-case"));
    expect(markup(example.right)).toContain("I can't stop");
    expect(markup(example.right)).toContain("Where did you go, my love?");
  });

  it("replaces the instrumental placeholder line with a rest", () => {
    const example = withExample(ruleById(LINES_AND_TEXT, "empty-instrumental"));
    expect(markup(example.wrong)).toContain("(instrumental)");
    expect(markup(example.right)).not.toContain("(instrumental)");
    expect(markup(example.right)).toContain("18 seconds of nothing");
  });

  it("keeps the surrounding verse and chorus lines on both sides of the instrumental example", () => {
    const example = withExample(ruleById(LINES_AND_TEXT, "empty-instrumental"));
    for (const half of [example.wrong, example.right]) {
      expect(markup(half)).toContain("The last line of the verse");
      expect(markup(half)).toContain("First line of the chorus");
    }
  });

  it("gives every rule in this group both halves of a comparison", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      const example = withExample(rule);
      expect(markup(example.wrong).length).toBeGreaterThan(0);
      expect(markup(example.right).length).toBeGreaterThan(0);
    }
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("LINES_AND_TEXT edge cases", () => {
  it("has no empty or whitespace-only body paragraph", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      for (const paragraph of rule.body) expect(paragraph.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no untrimmed title, paragraph or aside", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      expect(rule.title).toBe(rule.title.trim());
      for (const paragraph of rule.body) expect(paragraph).toBe(paragraph.trim());
      if (rule.aside) expect(rule.aside).toBe(rule.aside.trim());
    }
  });

  it("has no doubled space left behind by wrapping the copy across source lines", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      for (const paragraph of [rule.title, ...rule.body, rule.aside ?? ""]) {
        expect(paragraph).not.toContain("  ");
        expect(paragraph).not.toContain("\n");
      }
    }
  });

  it("has no aside that is present but empty", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      if (rule.aside !== undefined) expect(rule.aside.trim().length).toBeGreaterThan(0);
    }
  });
});

// -- Invariants ----------------------------------------------------------------

describe("LINES_AND_TEXT invariants", () => {
  it("gives every rule a unique id", () => {
    const ids = LINES_AND_TEXT.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lower case slug ids throughout", () => {
    expect(LINES_AND_TEXT.id).toMatch(SLUG);
    for (const rule of LINES_AND_TEXT.rules) expect(rule.id).toMatch(SLUG);
  });

  it("starts every title with a capital and ends it without a full stop", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      expect(rule.title[0]).toBe(rule.title[0]?.toUpperCase());
      expect(rule.title.endsWith(".")).toBe(false);
    }
  });

  it("reads the same on every access", () => {
    expect(LINES_AND_TEXT.rules.map((rule) => rule.title)).toEqual(LINES_AND_TEXT.rules.map((rule) => rule.title));
    expect(LINES_AND_TEXT.rules[0]).toBe(LINES_AND_TEXT.rules[0]);
  });

  it("keeps the copy free of forbidden punctuation rule by rule", () => {
    for (const rule of LINES_AND_TEXT.rules) {
      expectCleanRuleCopy({ id: LINES_AND_TEXT.id, label: LINES_AND_TEXT.label, rules: [rule] });
    }
  });
});
