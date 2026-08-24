import { describe, expect, it } from "vitest";
import { VOICES } from "@/best-practices/rules/voices";
import { expectCleanRuleCopy } from "@/test/copy-guards";
import { exampleDocument, markup, ruleById, SLUG, withExample } from "@/test/rule-fixtures";

// -- Group ---------------------------------------------------------------------

describe("VOICES", () => {
  it("is labelled for the group index", () => {
    expect(VOICES.label).toBe("Voices");
  });

  it("is identified by its slug", () => {
    expect(VOICES.id).toBe("voices");
  });

  it("holds the four voice rules in order", () => {
    expect(VOICES.rules.map((r) => r.id)).toEqual([
      "line-belongs-to-main",
      "credited-feature",
      "two-voices-is-chorus",
      "hand-off",
    ]);
  });

  it("gives every rule a title and at least one body paragraph", () => {
    for (const rule of VOICES.rules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.body.length).toBeGreaterThan(0);
    }
  });

  it("carries the paragraph counts the cards were written for", () => {
    expect(ruleById(VOICES, "line-belongs-to-main").body).toHaveLength(1);
    expect(ruleById(VOICES, "credited-feature").body).toHaveLength(3);
    expect(ruleById(VOICES, "two-voices-is-chorus").body).toHaveLength(2);
    expect(ruleById(VOICES, "hand-off").body).toHaveLength(2);
  });

  it("carries no aside anywhere in the group", () => {
    for (const rule of VOICES.rules) expect(rule.aside).toBeUndefined();
  });

  it("gives every rule both halves of a comparison", () => {
    for (const rule of VOICES.rules) {
      const example = withExample(rule);
      expect(markup(example.wrong).length).toBeGreaterThan(0);
      expect(markup(example.right).length).toBeGreaterThan(0);
    }
  });

  it("states both conditions for the credited-feature exception", () => {
    const copy = ruleById(VOICES, "credited-feature").body.join(" ");
    expect(copy).toMatch(/credited/i);
    expect(copy).toMatch(/words of their own|words that aren't just the lead's/i);
  });

  it("allows no exceptions on the chorus rule", () => {
    expect(ruleById(VOICES, "two-voices-is-chorus").body.join(" ")).toMatch(/no exceptions/i);
  });

  it("uses no forbidden punctuation in the copy", () => {
    expectCleanRuleCopy(VOICES);
  });
});

// -- Review locks --------------------------------------------------------------

describe("VOICES review locks", () => {
  it("names the credited-feature rule as the exception to the one above it", () => {
    expect(ruleById(VOICES, "credited-feature").body.join(" ")).toMatch(/exception to the one above/i);
  });

  it("leaves uncredited session backing where it is", () => {
    expect(ruleById(VOICES, "credited-feature").body.join(" ")).toMatch(/uncredited session backing stays/i);
  });

  it("sends a mid-phrase hand-off to the chorus rather than splitting it", () => {
    expect(ruleById(VOICES, "hand-off").body.join(" ")).toMatch(/mid-phrase/i);
    expect(ruleById(VOICES, "hand-off").body.join(" ")).toMatch(/chorus/i);
  });

  it("never mentions Apple Music", () => {
    const copy = VOICES.rules.flatMap((r) => [r.title, ...r.body, r.aside ?? ""]).join(" ");
    expect(copy).not.toMatch(/apple music/i);
  });
});

// -- Example copy --------------------------------------------------------------

describe("VOICES examples", () => {
  it("hands the line back to the artist who sang the main part", () => {
    const example = withExample(ruleById(VOICES, "line-belongs-to-main"));
    expect(markup(example.wrong)).toContain("Artist B");
    expect(markup(example.right)).toContain("Artist A");
    expect(markup(example.right)).not.toContain("Artist B");
  });

  it("changes nothing but the agent on the ownership example", () => {
    const example = withExample(ruleById(VOICES, "line-belongs-to-main"));
    for (const half of [example.wrong, example.right]) {
      expect(markup(half)).toContain("I've been waiting");
      expect(markup(half)).toContain("(waiting on you)");
    }
  });

  it("pulls the credited ad-lib out of the background and onto a line of its own", () => {
    const example = withExample(ruleById(VOICES, "credited-feature"));
    expect(markup(example.wrong)).toContain("(yeah, uh-huh)");
    expect(markup(example.right)).not.toContain("(yeah, uh-huh)");
    expect(markup(example.right)).toContain("Yeah, uh-huh");
  });

  it("credits the feature on the line it gains", () => {
    const example = withExample(ruleById(VOICES, "credited-feature"));
    expect(markup(example.wrong)).not.toContain("Feat. Artist B");
    expect(markup(example.right)).toContain("Feat. Artist B");
  });

  it("keeps the lead's own lines on both halves of the credited-feature example", () => {
    const example = withExample(ruleById(VOICES, "credited-feature"));
    for (const half of [example.wrong, example.right]) {
      expect(markup(half)).toContain("I've been waiting");
      expect(markup(half)).toContain("For you all night");
    }
  });

  it("collapses the doubled line into one chorus line", () => {
    const example = withExample(ruleById(VOICES, "two-voices-is-chorus"));
    expect(markup(example.wrong)).toContain("(we were never gonna make it)");
    expect(markup(example.right)).not.toContain("(we were never gonna make it)");
    expect(markup(example.right)).toContain("We were never gonna make it");
  });

  it("swaps the named artist for the chorus on the doubled line", () => {
    const example = withExample(ruleById(VOICES, "two-voices-is-chorus"));
    expect(markup(example.wrong)).toContain("Artist A");
    expect(markup(example.right)).not.toContain("Artist A");
    expect(markup(example.right)).toContain("Chorus");
  });

  it("moves the hand-off split onto the phrase boundary", () => {
    const example = withExample(ruleById(VOICES, "hand-off"));
    expect(markup(example.wrong)).toContain("I've been waiting for");
    expect(markup(example.wrong)).toContain("you all night");
    expect(markup(example.right)).toContain("For you all night");
  });

  it("shows the mid-phrase hand-off as one whole line given to the chorus", () => {
    const example = withExample(ruleById(VOICES, "hand-off"));
    expect(markup(example.right)).toContain("Chorus, when the hand-off lands mid-phrase");
    expect(markup(example.right)).toContain("I've been waiting for you all night");
    expect(markup(example.wrong)).not.toContain("Chorus");
  });

  it("draws three lines on the right of the hand-off example", () => {
    const example = withExample(ruleById(VOICES, "hand-off"));
    expect(exampleDocument(example.right).body.querySelectorAll("p.font-medium")).toHaveLength(3);
    expect(exampleDocument(example.wrong).body.querySelectorAll("p.font-medium")).toHaveLength(2);
  });

  it("sets the mid-phrase line apart from the two clean-break lines", () => {
    const example = withExample(ruleById(VOICES, "hand-off"));
    expect(exampleDocument(example.right).body.querySelectorAll(".mt-2")).toHaveLength(1);
    expect(exampleDocument(example.wrong).body.querySelectorAll(".mt-2")).toHaveLength(0);
  });

  it("labels every sample line in this group with an agent", () => {
    for (const rule of VOICES.rules) {
      const example = withExample(rule);
      for (const half of [example.wrong, example.right]) {
        const rendered = exampleDocument(half).body;
        expect(rendered.querySelectorAll("p.font-mono").length).toBe(rendered.querySelectorAll("p.font-medium").length);
      }
    }
  });

  it("keeps every agent label in sentence case", () => {
    for (const rule of VOICES.rules) {
      const example = withExample(rule);
      for (const half of [example.wrong, example.right]) {
        for (const label of exampleDocument(half).body.querySelectorAll("p.font-mono")) {
          const text = label.textContent ?? "";
          expect(text).not.toBe(text.toUpperCase());
          expect(text[0]).toBe(text[0]?.toUpperCase());
        }
      }
    }
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("VOICES edge cases", () => {
  it("has no empty or whitespace-only body paragraph", () => {
    for (const rule of VOICES.rules) {
      for (const paragraph of rule.body) expect(paragraph.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no untrimmed title or paragraph", () => {
    for (const rule of VOICES.rules) {
      expect(rule.title).toBe(rule.title.trim());
      for (const paragraph of rule.body) expect(paragraph).toBe(paragraph.trim());
    }
  });

  it("has no doubled space left behind by wrapping the copy across source lines", () => {
    for (const rule of VOICES.rules) {
      for (const paragraph of [rule.title, ...rule.body]) {
        expect(paragraph).not.toContain("  ");
        expect(paragraph).not.toContain("\n");
      }
    }
  });

  it("keeps every quoted fragment in the copy on straight double quotes", () => {
    for (const rule of VOICES.rules) {
      for (const paragraph of [rule.title, ...rule.body]) {
        expect((paragraph.match(/"/g) ?? []).length % 2).toBe(0);
      }
    }
  });
});

// -- Invariants ----------------------------------------------------------------

describe("VOICES invariants", () => {
  it("gives every rule a unique id", () => {
    const ids = VOICES.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lower case slug ids throughout", () => {
    expect(VOICES.id).toMatch(SLUG);
    for (const rule of VOICES.rules) expect(rule.id).toMatch(SLUG);
  });

  it("starts every title with a capital and ends it without a full stop", () => {
    for (const rule of VOICES.rules) {
      expect(rule.title[0]).toBe(rule.title[0]?.toUpperCase());
      expect(rule.title.endsWith(".")).toBe(false);
    }
  });

  it("reads the same on every access", () => {
    expect(VOICES.rules.map((rule) => rule.title)).toEqual(VOICES.rules.map((rule) => rule.title));
    expect(VOICES.rules[0]).toBe(VOICES.rules[0]);
  });

  it("keeps the copy free of forbidden punctuation rule by rule", () => {
    for (const rule of VOICES.rules) {
      expectCleanRuleCopy({ id: VOICES.id, label: VOICES.label, rules: [rule] });
    }
  });

  it("shares no rule id with the two groups that come before it", () => {
    const ids = new Set(VOICES.rules.map((rule) => rule.id));
    const earlier = [
      "one-breath-per-line",
      "sentence-case",
      "empty-instrumental",
      "brackets",
      "one-bracket-pair",
      "ad-libs-are-backgrounds",
      "ad-lib-in-a-gap",
      "doubling",
      "producer-tags",
    ];
    for (const id of earlier) expect(ids.has(id)).toBe(false);
  });
});
