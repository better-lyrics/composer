import { type DocPassthrough, isEmptyPassthrough, type Passthrough } from "insync/passthrough";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import { withLinePassthrough } from "@/domain/line/passthrough";
import { ITUNES_NS, isModelledAttribute, modelledChildTest, type TtmlNode } from "@/utils/lyrics-parsers/ttml-modelled";
import { xmlAttrsFromDom, xmlChildrenFromDom, xmlElementFromDom } from "@/utils/lyrics-parsers/xml-node-from-dom";
import { backgroundEnvelope, capturedTimes, lineEnvelope } from "@/utils/ttml-kept-times";
import { markupBaseText } from "@/utils/ttml-markup";

// -- Capture ------------------------------------------------------------------

function withoutEmpty(kept: Passthrough): Passthrough | undefined {
  return isEmptyPassthrough(kept) ? undefined : kept;
}

// The unmodelled attributes and children of one node, plus anything the caller adds.
function nodePassthrough(node: TtmlNode, element: Element, extra: Passthrough = {}): Passthrough | undefined {
  const attrs = xmlAttrsFromDom(element, (attr) => !isModelledAttribute(node, attr));
  const isModelled = modelledChildTest(node, element);
  const elements = Array.from(element.children)
    .filter((child) => !isModelled(child))
    .map(xmlElementFromDom);
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(elements.length > 0 && { elements }), ...extra });
}

// Several elements written as one, such as every `<metadata>` of a head.
function mergedPassthrough(node: TtmlNode, elements: readonly Element[]): Passthrough | undefined {
  const captured = elements.flatMap((element) => nodePassthrough(node, element) ?? []);
  const attrs = captured.flatMap((kept) => kept.attrs ?? []);
  const children = captured.flatMap((kept) => kept.elements ?? []);
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(children.length > 0 && { elements: children }) });
}

const childrenNamed = (parent: Element | undefined, name: string) =>
  parent ? Array.from(parent.children).filter((child) => child.tagName === name) : [];

// -- Document -----------------------------------------------------------------

function docPassthrough(doc: Document): DocPassthrough {
  const root = doc.documentElement;
  const [head] = childrenNamed(root, "head");
  const [body] = childrenNamed(root, "body");
  const iTunesMetadata =
    doc.getElementsByTagName("iTunesMetadata")[0] ?? doc.getElementsByTagNameNS(ITUNES_NS, "iTunesMetadata")[0];
  const captured: [keyof DocPassthrough, Passthrough | undefined][] = [
    ["tt", nodePassthrough("tt", root)],
    ["head", head && nodePassthrough("head", head)],
    ["metadata", mergedPassthrough("metadata", childrenNamed(head, "metadata"))],
    ["iTunesMetadata", iTunesMetadata && nodePassthrough("iTunesMetadata", iTunesMetadata)],
    ["body", body && nodePassthrough("body", body)],
  ];
  return Object.fromEntries(captured.filter(([, kept]) => kept !== undefined));
}

// -- Agents -------------------------------------------------------------------

function withAgentCapture(agent: Agent, element: Element, nameElement: Element | undefined): Agent {
  const passthrough = nodePassthrough("agent", element);
  const namePassthrough = nameElement && nodePassthrough("agentName", nameElement);
  return { ...agent, ...(passthrough && { passthrough }), ...(namePassthrough && { namePassthrough }) };
}

// -- Lines --------------------------------------------------------------------

const withTimes = (times: Passthrough["times"]) => (times ? { times } : {});

// A `<p>` and its x-bg container: unmodelled data, and their own times when the writer would not derive them.
function withParagraphCapture(line: LyricLine, paragraph: Element, background: Element | null): LyricLine {
  const kept = nodePassthrough("p", paragraph, withTimes(capturedTimes(paragraph, lineEnvelope(line), true)));
  const keptBackground =
    background &&
    nodePassthrough("background", background, withTimes(capturedTimes(background, backgroundEnvelope(line), false)));
  if (!kept && !keptBackground) return line;
  return withLinePassthrough(line, {
    ...(kept && { line: kept }),
    ...(keptBackground && { background: keptBackground }),
  });
}

// A timed span's text and unmodelled data; a span holding elements keeps them as markup and spells its base text.
function syllableCapture(span: Element): { text: string; passthrough?: Passthrough } {
  const markup = span.children.length > 0 ? xmlChildrenFromDom(span) : undefined;
  const base = markup && markupBaseText(markup);
  const keepsMarkup = base !== undefined && base.trim() !== "";
  const attrs = xmlAttrsFromDom(span, (attr) => !isModelledAttribute("syllable", attr));
  const passthrough = withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(keepsMarkup && { markup }) });
  return { text: keepsMarkup ? base : (span.textContent ?? ""), ...(passthrough && { passthrough }) };
}

// -- Exports ------------------------------------------------------------------

export { docPassthrough, nodePassthrough, syllableCapture, withAgentCapture, withParagraphCapture };
