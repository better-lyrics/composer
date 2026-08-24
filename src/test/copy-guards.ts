import { expect } from "vitest";
import type { RuleGroup } from "@/best-practices/model";

// -- Constants -----------------------------------------------------------------

// En dash, em dash, and the four curly quote characters. Written as escapes so
// this file does not itself contain the characters it bans.
const FORBIDDEN_PUNCTUATION = /[\u2013\u2014\u201c\u201d\u2018\u2019]/;

// -- Guards --------------------------------------------------------------------

function expectCleanRuleCopy(group: RuleGroup) {
  const copy = group.rules.flatMap((rule) => [rule.title, ...rule.body, rule.aside ?? ""]).join(" ");
  expect(copy).not.toMatch(FORBIDDEN_PUNCTUATION);
}

// -- Exports -------------------------------------------------------------------

export { expectCleanRuleCopy, FORBIDDEN_PUNCTUATION };
