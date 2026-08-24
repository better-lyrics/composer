import { describe, expect, it } from "vitest";
import { SYLLABLES } from "@/best-practices/rules/syllables";
import { expectCleanRuleCopy } from "@/test/copy-guards";
import { exampleDocument, renderedText, ruleById, SLUG, withExample } from "@/test/rule-fixtures";

// -- Helpers -------------------------------------------------------------------

function cutMarkers(node: React.ReactNode): number {
  return exampleDocument(node).body.querySelectorAll(".text-composer-accent-text").length;
}

// -- Group ---------------------------------------------------------------------

describe("SYLLABLES", () => {
  it("is labelled for the group index", () => {
    expect(SYLLABLES.label).toBe("Syllables");
  });

  it("is identified by its slug", () => {
    expect(SYLLABLES.id).toBe("syllables");
  });

  it("holds the two syllable rules in order", () => {
    expect(SYLLABLES.rules.map((r) => r.id)).toEqual(["split-on-stretch", "cut-on-boundary"]);
  });

  it("gives every rule a title and at least one body paragraph", () => {
    for (const rule of SYLLABLES.rules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.body.length).toBeGreaterThan(0);
    }
  });

  it("carries the paragraph counts the cards were written for", () => {
    expect(ruleById(SYLLABLES, "split-on-stretch").body).toHaveLength(2);
    expect(ruleById(SYLLABLES, "cut-on-boundary").body).toHaveLength(2);
  });

  it("puts an aside on the stretch rule alone", () => {
    expect(ruleById(SYLLABLES, "split-on-stretch").aside).toBeDefined();
    expect(ruleById(SYLLABLES, "cut-on-boundary").aside).toBeUndefined();
  });

  it("gives every rule both halves of a comparison", () => {
    for (const rule of SYLLABLES.rules) {
      const example = withExample(rule);
      expect(renderedText(example.wrong).length).toBeGreaterThan(0);
      expect(renderedText(example.right).length).toBeGreaterThan(0);
    }
  });

  it("tells authors not to stretch the spelling", () => {
    const rule = SYLLABLES.rules.find((r) => r.id === "split-on-stretch");
    expect(rule?.aside).toMatch(/never stretch the spelling/i);
  });

  it("uses no forbidden punctuation in the copy", () => {
    expectCleanRuleCopy(SYLLABLES);
  });
});

// -- Review locks --------------------------------------------------------------

describe("SYLLABLES review locks", () => {
  // The aside used to say the renderer derived the stretch "from the timing", which was wrong. A held
  // syllable is marked in the output and themes style it, so the negative assertion below stays.
  it("leaves the held note to the renderer rather than the spelling", () => {
    const aside = ruleById(SYLLABLES, "split-on-stretch").aside ?? "";
    expect(aside).toMatch(/never stretch the spelling/i);
    expect(aside).toMatch(/marked in the output/i);
    expect(aside).toMatch(/theme decides/i);
    expect(aside).not.toMatch(/from the timing/i);
  });

  it("keeps whole words as the default", () => {
    expect(ruleById(SYLLABLES, "split-on-stretch").body[0]).toMatch(/whole words by default/i);
  });

  it("turns down the dictionary as a reason to split", () => {
    expect(ruleById(SYLLABLES, "split-on-stretch").body.join(" ")).toMatch(/dictionary/i);
  });

  it("spells out the cut it wants and the cut it does not", () => {
    expect(ruleById(SYLLABLES, "cut-on-boundary").body.join(" ")).toContain("hel|lo, not hell|o");
  });

  it("gives the stretch no say in where the cut lands", () => {
    expect(ruleById(SYLLABLES, "cut-on-boundary").body.join(" ")).toMatch(/say in where the cut lands/i);
  });

  it("never mentions Apple Music", () => {
    const copy = SYLLABLES.rules.flatMap((r) => [r.title, ...r.body, r.aside ?? ""]).join(" ");
    expect(copy).not.toMatch(/apple music/i);
  });
});

// -- Example copy --------------------------------------------------------------

describe("SYLLABLES examples", () => {
  it("keeps the stretched spelling on the wrong side of the split rule", () => {
    const example = withExample(ruleById(SYLLABLES, "split-on-stretch"));
    expect(renderedText(example.wrong)).toContain("for|eeeeever");
    expect(renderedText(example.right)).not.toContain("for|eeeeever");
  });

  it("spells the held word normally on the right side", () => {
    const example = withExample(ruleById(SYLLABLES, "split-on-stretch"));
    expect(renderedText(example.right)).toContain("for|ever");
    expect(renderedText(example.wrong)).not.toContain("for|ever");
  });

  it("splits the long word by dictionary only on the wrong side", () => {
    const example = withExample(ruleById(SYLLABLES, "split-on-stretch"));
    expect(renderedText(example.wrong)).toContain("beau|ti|ful");
    expect(renderedText(example.right)).not.toContain("beau|ti|ful");
    expect(renderedText(example.right)).toContain("beautiful");
  });

  it("captions both halves of the split example", () => {
    const example = withExample(ruleById(SYLLABLES, "split-on-stretch"));
    expect(renderedText(example.wrong)).toContain("Spelling the stretch out");
    expect(renderedText(example.wrong)).toContain("Splitting by dictionary");
    expect(renderedText(example.right)).toContain('"forever", last syllable held');
    expect(renderedText(example.right)).toContain('"beautiful", sung straight');
  });

  it("cuts three times on the wrong side of the split example and once on the right", () => {
    const example = withExample(ruleById(SYLLABLES, "split-on-stretch"));
    expect(cutMarkers(example.wrong)).toBe(3);
    expect(cutMarkers(example.right)).toBe(1);
  });

  it("moves the cut off the held vowel and onto the syllable boundary", () => {
    const example = withExample(ruleById(SYLLABLES, "cut-on-boundary"));
    expect(renderedText(example.wrong)).toContain("hell|o");
    expect(renderedText(example.wrong)).not.toContain("hel|lo");
    expect(renderedText(example.right)).toContain("hel|lo");
    expect(renderedText(example.right)).not.toContain("hell|o");
  });

  it("captions both halves of the boundary example", () => {
    const example = withExample(ruleById(SYLLABLES, "cut-on-boundary"));
    expect(renderedText(example.wrong)).toContain("Cut where the held vowel starts");
    expect(renderedText(example.right)).toContain("Cut on the syllable boundary");
  });

  it("draws exactly one cut on each half of the boundary example", () => {
    const example = withExample(ruleById(SYLLABLES, "cut-on-boundary"));
    expect(cutMarkers(example.wrong)).toBe(1);
    expect(cutMarkers(example.right)).toBe(1);
  });

  it("keeps a stretched spelling out of every right-hand column", () => {
    for (const rule of SYLLABLES.rules) {
      expect(renderedText(withExample(rule).right)).not.toMatch(/(.)\1\1/);
    }
    expect(renderedText(withExample(ruleById(SYLLABLES, "split-on-stretch")).wrong)).toMatch(/(.)\1\1/);
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("SYLLABLES edge cases", () => {
  it("has no empty or whitespace-only body paragraph", () => {
    for (const rule of SYLLABLES.rules) {
      for (const paragraph of rule.body) expect(paragraph.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no untrimmed title, paragraph or aside", () => {
    for (const rule of SYLLABLES.rules) {
      expect(rule.title).toBe(rule.title.trim());
      for (const paragraph of rule.body) expect(paragraph).toBe(paragraph.trim());
      if (rule.aside) expect(rule.aside).toBe(rule.aside.trim());
    }
  });

  it("has no doubled space left behind by wrapping the copy across source lines", () => {
    for (const rule of SYLLABLES.rules) {
      for (const paragraph of [rule.title, ...rule.body, rule.aside ?? ""]) {
        expect(paragraph).not.toContain("  ");
        expect(paragraph).not.toContain("\n");
      }
    }
  });

  it("has no aside that is present but empty", () => {
    for (const rule of SYLLABLES.rules) {
      if (rule.aside !== undefined) expect(rule.aside.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps every quoted fragment in the copy on straight double quotes", () => {
    for (const rule of SYLLABLES.rules) {
      for (const paragraph of [rule.title, ...rule.body, rule.aside ?? ""]) {
        expect((paragraph.match(/"/g) ?? []).length % 2).toBe(0);
      }
    }
  });
});

// -- Invariants ----------------------------------------------------------------

describe("SYLLABLES invariants", () => {
  it("gives every rule a unique id", () => {
    const ids = SYLLABLES.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lower case slug ids throughout", () => {
    expect(SYLLABLES.id).toMatch(SLUG);
    for (const rule of SYLLABLES.rules) expect(rule.id).toMatch(SLUG);
  });

  it("starts every title with a capital and ends it without a full stop", () => {
    for (const rule of SYLLABLES.rules) {
      expect(rule.title[0]).toBe(rule.title[0]?.toUpperCase());
      expect(rule.title.endsWith(".")).toBe(false);
    }
  });

  it("reads the same on every access", () => {
    expect(SYLLABLES.rules.map((rule) => rule.title)).toEqual(SYLLABLES.rules.map((rule) => rule.title));
    expect(SYLLABLES.rules[0]).toBe(SYLLABLES.rules[0]);
  });

  it("keeps the copy free of forbidden punctuation rule by rule", () => {
    for (const rule of SYLLABLES.rules) {
      expectCleanRuleCopy({ id: SYLLABLES.id, label: SYLLABLES.label, rules: [rule] });
    }
  });

  it("shares no rule id with the three groups that come before it", () => {
    const ids = new Set(SYLLABLES.rules.map((rule) => rule.id));
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
      "line-belongs-to-main",
      "credited-feature",
      "two-voices-is-chorus",
      "hand-off",
    ];
    for (const id of earlier) expect(ids.has(id)).toBe(false);
  });
});
