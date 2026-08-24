import { renderToStaticMarkup } from "react-dom/server";
import { expect } from "vitest";
import type { RuleGroup } from "@/best-practices/model";

// -- Constants -----------------------------------------------------------------

// En dash, em dash, and the four curly quote characters. Written as escapes so
// this file does not itself contain the characters it bans.
const FORBIDDEN_PUNCTUATION = /[\u2013\u2014\u201c\u201d\u2018\u2019]/;

// -- Guards --------------------------------------------------------------------

// Reads rendered text rather than raw markup: renderToStaticMarkup escapes
// apostrophes into entities, and attribute values are not copy.
function renderedText(node: React.ReactNode): string {
  const rendered = new DOMParser().parseFromString(renderToStaticMarkup(node), "text/html");
  return rendered.body.textContent ?? "";
}

function expectCleanRuleCopy(group: RuleGroup) {
  const copy = group.rules
    .flatMap((rule) => [
      rule.title,
      ...rule.body,
      rule.aside ?? "",
      ...(rule.example ? [renderedText(rule.example.wrong), renderedText(rule.example.right)] : []),
    ])
    .join(" ");
  expect(copy).not.toMatch(FORBIDDEN_PUNCTUATION);
}

// -- Exports -------------------------------------------------------------------

export { expectCleanRuleCopy, FORBIDDEN_PUNCTUATION };
