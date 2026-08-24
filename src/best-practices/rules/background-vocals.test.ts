import { describe, expect, it } from "vitest";
import { BACKGROUND_VOCALS } from "@/best-practices/rules/background-vocals";
import { expectCleanRuleCopy } from "@/test/copy-guards";
import { exampleDocument, renderedText, ruleById, SLUG, withExample } from "@/test/rule-fixtures";

// -- Helpers -------------------------------------------------------------------

function paragraphBoxes(node: React.ReactNode): number {
  return exampleDocument(node).body.querySelectorAll(".border-dashed").length;
}

// -- Group ---------------------------------------------------------------------

describe("BACKGROUND_VOCALS", () => {
  it("is labelled for the group index", () => {
    expect(BACKGROUND_VOCALS.label).toBe("Background vocals");
  });

  it("is identified by its slug", () => {
    expect(BACKGROUND_VOCALS.id).toBe("background-vocals");
  });

  it("holds the six background rules in order", () => {
    expect(BACKGROUND_VOCALS.rules.map((r) => r.id)).toEqual([
      "brackets",
      "one-bracket-pair",
      "ad-libs-are-backgrounds",
      "ad-lib-in-a-gap",
      "doubling",
      "producer-tags",
    ]);
  });

  it("gives every rule a title and at least one body paragraph", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.body.length).toBeGreaterThan(0);
    }
  });

  it("carries the paragraph counts the cards were written for", () => {
    expect(ruleById(BACKGROUND_VOCALS, "brackets").body).toHaveLength(2);
    expect(ruleById(BACKGROUND_VOCALS, "one-bracket-pair").body).toHaveLength(1);
    expect(ruleById(BACKGROUND_VOCALS, "ad-libs-are-backgrounds").body).toHaveLength(2);
    expect(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap").body).toHaveLength(3);
    expect(ruleById(BACKGROUND_VOCALS, "doubling").body).toHaveLength(3);
    expect(ruleById(BACKGROUND_VOCALS, "producer-tags").body).toHaveLength(1);
  });

  it("puts an aside on the bracket-pair and ad-lib rules alone", () => {
    expect(ruleById(BACKGROUND_VOCALS, "one-bracket-pair").aside).toBeDefined();
    expect(ruleById(BACKGROUND_VOCALS, "ad-libs-are-backgrounds").aside).toBeDefined();
    for (const id of ["brackets", "ad-lib-in-a-gap", "doubling", "producer-tags"]) {
      expect(ruleById(BACKGROUND_VOCALS, id).aside).toBeUndefined();
    }
  });

  it("runs the two rules with nothing worth drawing as text only", () => {
    expect(ruleById(BACKGROUND_VOCALS, "doubling").example).toBeUndefined();
    expect(ruleById(BACKGROUND_VOCALS, "producer-tags").example).toBeUndefined();
  });

  it("gives the first four rules both halves of a comparison", () => {
    for (const id of ["brackets", "one-bracket-pair", "ad-libs-are-backgrounds", "ad-lib-in-a-gap"]) {
      const example = withExample(ruleById(BACKGROUND_VOCALS, id));
      expect(renderedText(example.wrong).length).toBeGreaterThan(0);
      expect(renderedText(example.right).length).toBeGreaterThan(0);
    }
  });

  it("points at the bracket-preservation setting from the one-pair rule", () => {
    const rule = BACKGROUND_VOCALS.rules.find((r) => r.id === "one-bracket-pair");
    expect(rule?.aside).toMatch(/Preserve brackets when extracting/);
  });

  it("sends the credited-feature exception over to the Voices group", () => {
    expect(ruleById(BACKGROUND_VOCALS, "ad-libs-are-backgrounds").aside).toMatch(/Voices/);
  });

  it("uses no forbidden punctuation in the copy", () => {
    expectCleanRuleCopy(BACKGROUND_VOCALS);
  });
});

// -- Review locks --------------------------------------------------------------

describe("BACKGROUND_VOCALS review locks", () => {
  it("makes no claim about where the renderer positions a background", () => {
    const copy = BACKGROUND_VOCALS.rules.flatMap((r) => r.body).join(" ");
    expect(copy).not.toMatch(/own line (beneath|under|below) the main/i);
  });

  it("never mentions Apple Music", () => {
    const copy = BACKGROUND_VOCALS.rules.flatMap((r) => [r.title, ...r.body, r.aside ?? ""]).join(" ");
    expect(copy).not.toMatch(/apple music/i);
  });
});

// -- Example copy --------------------------------------------------------------

describe("BACKGROUND_VOCALS examples", () => {
  it("adds the missing brackets around the background run", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "brackets"));
    expect(renderedText(example.wrong)).toContain("ooh yeah");
    expect(renderedText(example.wrong)).not.toContain("(ooh yeah)");
    expect(renderedText(example.right)).toContain("(ooh yeah)");
    for (const half of [example.wrong, example.right]) expect(renderedText(half)).toContain("I can't stop");
  });

  it("collapses two bracket pairs into one outer pair", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "one-bracket-pair"));
    expect(renderedText(example.wrong)).toContain("(ooh yeah) (ooh yeah)");
    expect(renderedText(example.right)).toContain("(ooh yeah, ooh yeah)");
    for (const half of [example.wrong, example.right])
      expect(renderedText(half)).toContain("Running through the night");
  });

  it("demotes the promoted ad-lib line into a bracketed background", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "ad-libs-are-backgrounds"));
    expect(renderedText(example.wrong)).toContain("Uh, come on");
    expect(renderedText(example.wrong)).not.toContain("(uh, come on)");
    expect(renderedText(example.right)).toContain("(uh, come on)");
    for (const half of [example.wrong, example.right]) expect(renderedText(half)).toContain("Take it higher");
  });

  it("captions the gap example for the one attached case and the two split cases", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap"));
    expect(renderedText(example.wrong)).toContain("Far out, still one paragraph");
    expect(renderedText(example.right)).toContain("Close by, one paragraph");
    expect(renderedText(example.right)).toContain("Far out, two paragraphs");
  });

  it("spells out the cost of the stretched paragraph on the wrong side", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap"));
    expect(renderedText(example.wrong)).toContain("The verse line hangs on screen through the whole gap.");
    expect(renderedText(example.right)).not.toContain("hangs on screen");
  });

  it("drops the brackets on the ad-lib that earns a line of its own", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap"));
    expect(renderedText(example.wrong)).toContain("(yeah!)");
    expect(renderedText(example.right)).toContain("(yeah!)");
    expect(renderedText(example.right)).toContain("Yeah!");
    expect(renderedText(example.wrong)).not.toContain("Yeah!");
  });

  it("draws the far-out ad-lib as a single stretched paragraph on the wrong side", () => {
    expect(paragraphBoxes(withExample(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap")).wrong)).toBe(1);
  });

  it("draws the close-by case as one paragraph and the far-out case as two on the right side", () => {
    expect(paragraphBoxes(withExample(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap")).right)).toBe(3);
  });

  it("names the verse line and the ad-lib in every timing strip", () => {
    const example = withExample(ruleById(BACKGROUND_VOCALS, "ad-lib-in-a-gap"));
    for (const half of [example.wrong, example.right]) {
      expect(renderedText(half)).toContain("verse line");
      expect(renderedText(half)).toContain("Last line of the verse");
    }
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("BACKGROUND_VOCALS edge cases", () => {
  it("has no empty or whitespace-only body paragraph", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      for (const paragraph of rule.body) expect(paragraph.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no untrimmed title, paragraph or aside", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      expect(rule.title).toBe(rule.title.trim());
      for (const paragraph of rule.body) expect(paragraph).toBe(paragraph.trim());
      if (rule.aside) expect(rule.aside).toBe(rule.aside.trim());
    }
  });

  it("has no doubled space left behind by wrapping the copy across source lines", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      for (const paragraph of [rule.title, ...rule.body, rule.aside ?? ""]) {
        expect(paragraph).not.toContain("  ");
        expect(paragraph).not.toContain("\n");
      }
    }
  });

  it("has no aside that is present but empty", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      if (rule.aside !== undefined) expect(rule.aside.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps every quoted fragment in the copy on straight double quotes", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      for (const paragraph of [rule.title, ...rule.body, rule.aside ?? ""]) {
        expect((paragraph.match(/"/g) ?? []).length % 2).toBe(0);
      }
    }
  });
});

// -- Invariants ----------------------------------------------------------------

describe("BACKGROUND_VOCALS invariants", () => {
  it("gives every rule a unique id", () => {
    const ids = BACKGROUND_VOCALS.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lower case slug ids throughout", () => {
    expect(BACKGROUND_VOCALS.id).toMatch(SLUG);
    for (const rule of BACKGROUND_VOCALS.rules) expect(rule.id).toMatch(SLUG);
  });

  it("starts every title with a capital and ends it without a full stop", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      expect(rule.title[0]).toBe(rule.title[0]?.toUpperCase());
      expect(rule.title.endsWith(".")).toBe(false);
    }
  });

  it("reads the same on every access", () => {
    expect(BACKGROUND_VOCALS.rules.map((rule) => rule.title)).toEqual(
      BACKGROUND_VOCALS.rules.map((rule) => rule.title),
    );
    expect(BACKGROUND_VOCALS.rules[0]).toBe(BACKGROUND_VOCALS.rules[0]);
  });

  it("keeps the copy free of forbidden punctuation rule by rule", () => {
    for (const rule of BACKGROUND_VOCALS.rules) {
      expectCleanRuleCopy({ id: BACKGROUND_VOCALS.id, label: BACKGROUND_VOCALS.label, rules: [rule] });
    }
  });

  it("shares no rule id with the group that comes before it", () => {
    const ids = new Set(BACKGROUND_VOCALS.rules.map((rule) => rule.id));
    for (const id of ["one-breath-per-line", "sentence-case", "empty-instrumental"]) expect(ids.has(id)).toBe(false);
  });
});
