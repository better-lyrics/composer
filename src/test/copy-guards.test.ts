import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { Rule, RuleGroup } from "@/best-practices/model";
import { expectCleanRuleCopy } from "@/test/copy-guards";

// -- Fixtures ------------------------------------------------------------------

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);
const CURLY_OPEN_QUOTE = String.fromCharCode(0x201c);
const CURLY_CLOSE_QUOTE = String.fromCharCode(0x201d);
const CURLY_OPEN_APOSTROPHE = String.fromCharCode(0x2018);
const CURLY_CLOSE_APOSTROPHE = String.fromCharCode(0x2019);

function ruleWith(overrides: Partial<Rule>): Rule {
  return { id: "fixture-rule", title: "Backgrounds carry brackets", body: ["Not required."], ...overrides };
}

function groupOf(...rules: Rule[]): RuleGroup {
  return { id: "fixture-group", label: "Fixture group", rules };
}

function guard(group: RuleGroup): () => void {
  return () => {
    expectCleanRuleCopy(group);
  };
}

// -- Clean copy ----------------------------------------------------------------

describe("expectCleanRuleCopy", () => {
  it("accepts a group whose copy uses straight punctuation throughout", () => {
    const group = groupOf(
      ruleWith({
        title: "One pair of brackets for the whole run",
        body: ["Two background snippets in the same line share one outer pair."],
        aside: "Preserve brackets when extracting does this for you.",
        example: {
          wrong: createElement("span", null, "(ooh yeah) (ooh yeah)"),
          right: createElement("span", null, "(ooh yeah, ooh yeah)"),
        },
      }),
    );
    expect(guard(group)).not.toThrow();
  });

  it("accepts a rule that carries no example at all", () => {
    const group = groupOf(ruleWith({ body: ["An intelligible shout can go in as a background."] }));
    expect(guard(group)).not.toThrow();
  });

  it("accepts an example whose apostrophes are straight once the markup is decoded", () => {
    const group = groupOf(
      ruleWith({
        example: {
          wrong: createElement("p", null, "i cant stop."),
          right: createElement("p", null, "I can't stop"),
        },
      }),
    );
    expect(guard(group)).not.toThrow();
  });

  it("accepts an example half that is a bare string", () => {
    const group = groupOf(ruleWith({ example: { wrong: "ooh yeah", right: "(ooh yeah)" } }));
    expect(guard(group)).not.toThrow();
  });

  it("accepts an example half that renders nothing", () => {
    const group = groupOf(ruleWith({ example: { wrong: null, right: createElement("span", null, "(uh, come on)") } }));
    expect(guard(group)).not.toThrow();
  });

  it("accepts a group holding no rules", () => {
    expect(guard(groupOf())).not.toThrow();
  });
});

// -- Violations ----------------------------------------------------------------

describe("expectCleanRuleCopy violations", () => {
  it("rejects a curly apostrophe in a title", () => {
    const group = groupOf(ruleWith({ title: `Ad-libs are what you can${CURLY_CLOSE_APOSTROPHE}t skip` }));
    expect(guard(group)).toThrow();
  });

  it("rejects an em dash in a body paragraph", () => {
    const group = groupOf(ruleWith({ body: [`Not required${EM_DASH}the file validates fine without them.`] }));
    expect(guard(group)).toThrow();
  });

  it("rejects an en dash in an aside", () => {
    const group = groupOf(ruleWith({ aside: `One exception ${EN_DASH} a credited artist ad-libbing.` }));
    expect(guard(group)).toThrow();
  });

  it("rejects a curly quote inside the wrong half of an example", () => {
    const group = groupOf(
      ruleWith({
        example: {
          wrong: createElement("span", null, `${CURLY_OPEN_QUOTE}ooh yeah${CURLY_CLOSE_QUOTE}`),
          right: createElement("span", null, "(ooh yeah)"),
        },
      }),
    );
    expect(guard(group)).toThrow();
  });

  it("rejects a curly apostrophe inside the right half of an example", () => {
    const group = groupOf(
      ruleWith({
        example: {
          wrong: createElement("span", null, "i cant stop."),
          right: createElement("span", null, `I can${CURLY_CLOSE_APOSTROPHE}t stop`),
        },
      }),
    );
    expect(guard(group)).toThrow();
  });

  it("rejects an opening curly apostrophe nested deep inside example markup", () => {
    const group = groupOf(
      ruleWith({
        example: {
          wrong: createElement("span", null, "Take it higher"),
          right: createElement(
            "div",
            null,
            createElement("p", null, "Take it higher"),
            createElement("p", null, createElement("em", null, `${CURLY_OPEN_APOSTROPHE}round midnight`)),
          ),
        },
      }),
    );
    expect(guard(group)).toThrow();
  });

  it("rejects a forbidden character in an example half given as a bare string", () => {
    const group = groupOf(ruleWith({ example: { wrong: `ooh${EM_DASH}yeah`, right: "(ooh yeah)" } }));
    expect(guard(group)).toThrow();
  });

  it("rejects a violation in the last rule of the group, not only the first", () => {
    const group = groupOf(
      ruleWith({ id: "brackets" }),
      ruleWith({ id: "doubling" }),
      ruleWith({
        id: "producer-tags",
        example: {
          wrong: createElement("span", null, "a laugh"),
          right: createElement("span", null, `an intelligible ${CURLY_OPEN_QUOTE}yeah!${CURLY_CLOSE_QUOTE}`),
        },
      }),
    );
    expect(guard(group)).toThrow();
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("expectCleanRuleCopy edge cases", () => {
  it("ignores forbidden characters that live in markup attributes rather than copy", () => {
    const group = groupOf(
      ruleWith({
        example: {
          wrong: createElement("span", { title: `not copy ${EM_DASH} an attribute` }, "ooh yeah"),
          right: createElement("span", null, "(ooh yeah)"),
        },
      }),
    );
    expect(guard(group)).not.toThrow();
  });

  it("reads copy out of a rule whose body is empty", () => {
    const group = groupOf(
      ruleWith({
        body: [],
        example: {
          wrong: createElement("span", null, `ooh${EN_DASH}yeah`),
          right: createElement("span", null, "(ooh yeah)"),
        },
      }),
    );
    expect(guard(group)).toThrow();
  });

  it("catches a forbidden character that sits alone with no surrounding words", () => {
    const group = groupOf(ruleWith({ example: { wrong: CURLY_CLOSE_QUOTE, right: "(ooh yeah)" } }));
    expect(guard(group)).toThrow();
  });
});

// -- Invariants ----------------------------------------------------------------

describe("expectCleanRuleCopy invariants", () => {
  it("leaves the group it inspects unchanged", () => {
    const example = {
      wrong: createElement("span", null, "ooh yeah"),
      right: createElement("span", null, "(ooh yeah)"),
    };
    const rule = ruleWith({ example });
    const group = groupOf(rule);
    expectCleanRuleCopy(group);
    expect(group.rules[0]).toBe(rule);
    expect(group.rules[0]?.example).toBe(example);
    expect(group.rules).toHaveLength(1);
  });

  it("reaches the same verdict on repeated runs over the same group", () => {
    const group = groupOf(ruleWith({ example: { wrong: `ooh${EM_DASH}yeah`, right: "(ooh yeah)" } }));
    expect(guard(group)).toThrow();
    expect(guard(group)).toThrow();
  });

  it("catches every banned character on its own", () => {
    const banned = [
      EN_DASH,
      EM_DASH,
      CURLY_OPEN_QUOTE,
      CURLY_CLOSE_QUOTE,
      CURLY_OPEN_APOSTROPHE,
      CURLY_CLOSE_APOSTROPHE,
    ];
    for (const character of banned) {
      const group = groupOf(ruleWith({ example: { wrong: createElement("span", null, character), right: "clean" } }));
      expect(guard(group)).toThrow();
    }
  });
});
