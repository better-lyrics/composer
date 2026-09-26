import { renderToStaticMarkup } from "react-dom/server";
import type { Rule, RuleGroup } from "@/best-practices/model";

// -- Constants -----------------------------------------------------------------

const SLUG = /^[a-z]+(-[a-z]+)*$/;

// -- Helpers -------------------------------------------------------------------

function exampleDocument(node: React.ReactNode): Document {
  return new DOMParser().parseFromString(renderToStaticMarkup(node), "text/html");
}

// Reads rendered text rather than raw markup: renderToStaticMarkup escapes
// apostrophes into entities, and attribute values are not copy.
function renderedText(node: React.ReactNode): string {
  return exampleDocument(node).body.textContent ?? "";
}

function withExample(rule: Rule): NonNullable<Rule["example"]> {
  if (!rule.example) throw new Error(`Rule ${rule.id} carries no example`);
  return rule.example;
}

function ruleById(group: RuleGroup, id: string): Rule {
  const rule = group.rules.find((candidate) => candidate.id === id);
  if (!rule) throw new Error(`No rule with id ${id} in group ${group.id}`);
  return rule;
}

// -- Exports -------------------------------------------------------------------

export { exampleDocument, renderedText, ruleById, SLUG, withExample };
