import { matchesAllTerms } from "@/utils/search-terms";

// -- Constants -----------------------------------------------------------------

const TOPIC_SELECTOR = "[data-help-topic]";
const HELP_MATCH_HIGHLIGHT = "help-match";

// -- Helpers -------------------------------------------------------------------

function searchableTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("[data-search-ignore]")) continue;
    nodes.push(node as Text);
  }
  return nodes;
}

function filterChildren(parent: Element, label: string, terms: readonly string[]): number {
  let count = 0;
  for (const child of parent.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.matches(TOPIC_SELECTOR)) {
      const text = searchableTextNodes(child)
        .map((node) => node.data)
        .join(" ");
      child.hidden = !matchesAllTerms(`${text} ${label}`, terms);
      if (!child.hidden) count++;
    } else if (child.querySelector(TOPIC_SELECTOR)) {
      const nested = filterChildren(child, label, terms);
      child.hidden = nested === 0;
      count += nested;
    } else {
      child.hidden = true;
    }
  }
  return count;
}

// -- Filter --------------------------------------------------------------------

function filterHelpTopics(root: HTMLElement, terms: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const section of root.querySelectorAll<HTMLElement>("[data-help-result-section]")) {
    const id = section.dataset.helpResultSection ?? "";
    const body = section.querySelector("[data-help-result-body]");
    const count = body ? filterChildren(body, section.dataset.helpSectionLabel ?? "", terms) : 0;
    section.hidden = count === 0;
    if (count > 0) counts[id] = count;
  }
  return counts;
}

// -- Highlight -----------------------------------------------------------------

function paintHelpMatches(root: HTMLElement, terms: readonly string[]): void {
  if (!("highlights" in CSS)) return;
  const ranges: Range[] = [];
  for (const node of searchableTextNodes(root)) {
    if (node.parentElement?.closest("[hidden]") || !node.parentElement?.closest(TOPIC_SELECTOR)) continue;
    const lowered = node.data.toLowerCase();
    for (const term of terms) {
      for (let index = lowered.indexOf(term); index !== -1; index = lowered.indexOf(term, index + term.length)) {
        const range = new Range();
        range.setStart(node, index);
        range.setEnd(node, index + term.length);
        ranges.push(range);
      }
    }
  }
  CSS.highlights.set(HELP_MATCH_HIGHLIGHT, new Highlight(...ranges));
}

function clearHelpMatches(): void {
  if ("highlights" in CSS) CSS.highlights.delete(HELP_MATCH_HIGHLIGHT);
}

// -- Exports -------------------------------------------------------------------

export { clearHelpMatches, filterHelpTopics, HELP_MATCH_HIGHLIGHT, paintHelpMatches };
