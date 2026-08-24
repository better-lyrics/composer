import { describe, expect, it } from "vitest";
import { TIMING } from "@/best-practices/rules/timing";
import { expectCleanRuleCopy } from "@/test/copy-guards";
import { exampleDocument, renderedText, ruleById, SLUG, withExample } from "@/test/rule-fixtures";

// -- Helpers -------------------------------------------------------------------

function wordBlocks(node: React.ReactNode): Element[] {
  return [...exampleDocument(node).body.querySelectorAll("span.grid")];
}

function gapCells(node: React.ReactNode): Element[] {
  return [...exampleDocument(node).body.querySelectorAll("span.rounded-sm:not(.grid)")];
}

// -- Group ---------------------------------------------------------------------

describe("TIMING", () => {
  it("is labelled for the group index", () => {
    expect(TIMING.label).toBe("Timing");
  });

  it("is identified by its slug", () => {
    expect(TIMING.id).toBe("timing");
  });

  it("holds the two timing rules in order", () => {
    expect(TIMING.rules.map((r) => r.id)).toEqual(["keep-the-pauses", "link-the-repeats"]);
  });

  it("gives every rule a title and at least one body paragraph", () => {
    for (const rule of TIMING.rules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.body.length).toBeGreaterThan(0);
    }
  });

  it("carries the paragraph counts the cards were written for", () => {
    expect(ruleById(TIMING, "keep-the-pauses").body).toHaveLength(2);
    expect(ruleById(TIMING, "link-the-repeats").body).toHaveLength(3);
  });

  it("carries no aside anywhere in the group", () => {
    for (const rule of TIMING.rules) expect(rule.aside).toBeUndefined();
  });

  it("runs the linked-repeats rule as text only", () => {
    expect(ruleById(TIMING, "link-the-repeats").example).toBeUndefined();
  });

  it("gives the pause rule both halves of a comparison", () => {
    const example = withExample(ruleById(TIMING, "keep-the-pauses"));
    expect(renderedText(example.wrong).length).toBeGreaterThan(0);
    expect(renderedText(example.right).length).toBeGreaterThan(0);
  });

  it("says plainly that timing does not propagate across linked instances", () => {
    const rule = TIMING.rules.find((r) => r.id === "link-the-repeats");
    const copy = rule?.body.join(" ") ?? "";
    expect(copy).toMatch(/timing is the exception/i);
    expect(copy).toMatch(/each instance keeps its own/i);
  });

  it("uses no forbidden punctuation in the copy", () => {
    expectCleanRuleCopy(TIMING);
  });
});

// -- Review locks --------------------------------------------------------------

describe("TIMING review locks", () => {
  // Locked against extractLinkedFields in src/domain/group/linking.ts, which
  // propagates text, agentId, backgroundText and backgroundTextSource only. If
  // timing ever starts propagating, update this copy rather than drop the test.
  it("names the three timing fields that stay instance-local", () => {
    const copy = ruleById(TIMING, "link-the-repeats").body.join(" ");
    expect(copy).toMatch(/begin, end and word timings/i);
    expect(copy).toMatch(/stay exactly where they were/i);
  });

  it("names the fields that do follow a linked edit", () => {
    const copy = ruleById(TIMING, "link-the-repeats").body.join(" ");
    expect(copy).toMatch(/the voice on the line and the background text/i);
  });

  it("treats a repeated chorus as one piece of work", () => {
    expect(ruleById(TIMING, "link-the-repeats").body[0]).toMatch(/one piece of work, not three/i);
  });

  it("allows flush timing where the phrase really is sung in one breath", () => {
    expect(ruleById(TIMING, "keep-the-pauses").body.join(" ")).toMatch(/sung in one breath/i);
  });

  it("covers a pause inside a word that has been split", () => {
    expect(ruleById(TIMING, "keep-the-pauses").body.join(" ")).toMatch(/inside a word you've split/i);
  });

  it("never mentions Apple Music", () => {
    const copy = TIMING.rules.flatMap((r) => [r.title, ...r.body, r.aside ?? ""]).join(" ");
    expect(copy).not.toMatch(/apple music/i);
  });
});

// -- Example copy --------------------------------------------------------------

describe("TIMING examples", () => {
  it("names the same five words on both halves of the pause example", () => {
    const example = withExample(ruleById(TIMING, "keep-the-pauses"));
    for (const half of [example.wrong, example.right]) {
      expect(wordBlocks(half).map((block) => block.textContent)).toEqual(["I", "can't", "stop", "think", "ing"]);
    }
  });

  it("butts every word flush together on the wrong side", () => {
    expect(gapCells(withExample(ruleById(TIMING, "keep-the-pauses")).wrong)).toHaveLength(0);
  });

  it("leaves the breath in as a single gap on the right side", () => {
    const gaps = gapCells(withExample(ruleById(TIMING, "keep-the-pauses")).right);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.className).toContain("w-8");
  });

  it("drops the gap between the third and fourth word on the right side", () => {
    const strip = [
      ...exampleDocument(withExample(ruleById(TIMING, "keep-the-pauses")).right).body.querySelectorAll(
        "span.grid, span.rounded-sm:not(.grid)",
      ),
    ];
    expect(strip[2]?.textContent).toBe("stop");
    expect(strip[3]?.textContent).toBe("");
    expect(strip[4]?.textContent).toBe("think");
  });

  it("stretches the held word only on the wrong side", () => {
    const example = withExample(ruleById(TIMING, "keep-the-pauses"));
    const wrongHeld = exampleDocument(example.wrong).body.querySelector(".bg-composer-accent");
    const rightHeld = exampleDocument(example.right).body.querySelector(".bg-composer-accent");
    expect(wrongHeld?.textContent).toBe("stop");
    expect(rightHeld?.textContent).toBe("stop");
    expect(wrongHeld?.className).toContain("px-5");
    expect(rightHeld?.className).not.toContain("px-5");
  });

  it("highlights the held word and nothing else on either half", () => {
    const example = withExample(ruleById(TIMING, "keep-the-pauses"));
    for (const half of [example.wrong, example.right]) {
      expect(exampleDocument(half).body.querySelectorAll(".bg-composer-accent")).toHaveLength(1);
    }
  });

  it("captions both halves of the pause example", () => {
    const example = withExample(ruleById(TIMING, "keep-the-pauses"));
    expect(renderedText(example.wrong)).toContain('"stop" stretched to swallow the rest');
    expect(renderedText(example.right)).toContain("The breath left where it actually is");
  });

  it("draws no paragraph box on either half of the pause example", () => {
    const example = withExample(ruleById(TIMING, "keep-the-pauses"));
    for (const half of [example.wrong, example.right]) {
      expect(exampleDocument(half).body.querySelectorAll(".border-dashed")).toHaveLength(0);
    }
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("TIMING edge cases", () => {
  it("has no empty or whitespace-only body paragraph", () => {
    for (const rule of TIMING.rules) {
      for (const paragraph of rule.body) expect(paragraph.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no untrimmed title or paragraph", () => {
    for (const rule of TIMING.rules) {
      expect(rule.title).toBe(rule.title.trim());
      for (const paragraph of rule.body) expect(paragraph).toBe(paragraph.trim());
    }
  });

  it("has no doubled space left behind by wrapping the copy across source lines", () => {
    for (const rule of TIMING.rules) {
      for (const paragraph of [rule.title, ...rule.body]) {
        expect(paragraph).not.toContain("  ");
        expect(paragraph).not.toContain("\n");
      }
    }
  });

  it("keeps every quoted fragment in the copy on straight double quotes", () => {
    for (const rule of TIMING.rules) {
      for (const paragraph of [rule.title, ...rule.body]) {
        expect((paragraph.match(/"/g) ?? []).length % 2).toBe(0);
      }
    }
  });
});

// -- Invariants ----------------------------------------------------------------

describe("TIMING invariants", () => {
  it("gives every rule a unique id", () => {
    const ids = TIMING.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lower case slug ids throughout", () => {
    expect(TIMING.id).toMatch(SLUG);
    for (const rule of TIMING.rules) expect(rule.id).toMatch(SLUG);
  });

  it("starts every title with a capital and ends it without a full stop", () => {
    for (const rule of TIMING.rules) {
      expect(rule.title[0]).toBe(rule.title[0]?.toUpperCase());
      expect(rule.title.endsWith(".")).toBe(false);
    }
  });

  it("reads the same on every access", () => {
    expect(TIMING.rules.map((rule) => rule.title)).toEqual(TIMING.rules.map((rule) => rule.title));
    expect(TIMING.rules[0]).toBe(TIMING.rules[0]);
  });

  it("keeps the copy free of forbidden punctuation rule by rule", () => {
    for (const rule of TIMING.rules) {
      expectCleanRuleCopy({ id: TIMING.id, label: TIMING.label, rules: [rule] });
    }
  });

  it("shares no rule id with the four groups that come before it", () => {
    const ids = new Set(TIMING.rules.map((rule) => rule.id));
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
      "split-on-stretch",
      "cut-on-boundary",
    ];
    for (const id of earlier) expect(ids.has(id)).toBe(false);
  });
});
