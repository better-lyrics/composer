import { type DocPassthrough, isEmptyPassthrough, type Passthrough } from "insync/passthrough";
import type { XmlAttr, XmlElement } from "insync/xml-node";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import { withLinePassthrough } from "@/domain/line/passthrough";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import {
  type AnchorOf,
  noAnchors,
  rootAnchors,
  sectionAnchors,
  trackAnchors,
} from "@/utils/lyrics-parsers/ttml-anchors";
import { ITUNES_NS, isModelledAttribute, modelledChildTest, type TtmlNode } from "@/utils/lyrics-parsers/ttml-modelled";
import { xmlAttrsFromDom, xmlChildrenFromDom, xmlElementFromDom } from "@/utils/lyrics-parsers/xml-node-from-dom";
import { backgroundEnvelope, capturedTimes, lineEnvelope } from "@/utils/ttml-kept-times";
import { markupBaseText } from "@/utils/ttml-markup";

// -- Capture ------------------------------------------------------------------

function withoutEmpty(kept: Passthrough): Passthrough | undefined {
  return isEmptyPassthrough(kept) ? undefined : kept;
}

// The unmodelled children of one node, and the anchor each followed when any came before an anchor.
function keptChildren(
  node: TtmlNode,
  element: Element,
  anchorOf: AnchorOf,
): Pick<Passthrough, "elements" | "elementsAfter"> {
  const isModelled = modelledChildTest(node, element);
  const elements: XmlElement[] = [];
  const elementsAfter: (string | null)[] = [];
  let last: string | null = null;
  for (const child of element.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && !isModelled(child as Element)) {
      elements.push(xmlElementFromDom(child as Element));
      elementsAfter.push(last);
    } else last = anchorOf(child) ?? last;
  }
  if (elements.length === 0) return {};
  return { elements, ...(elementsAfter.some((anchor) => anchor !== last) && { elementsAfter }) };
}

// The unmodelled attributes and children of one node, plus anything the caller adds.
function nodePassthrough(
  node: TtmlNode,
  element: Element,
  extra: Passthrough = {},
  anchorOf: AnchorOf = noAnchors,
): Passthrough | undefined {
  const attrs = xmlAttrsFromDom(element, (attr) => !isModelledAttribute(node, attr));
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...keptChildren(node, element, anchorOf), ...extra });
}

// Several elements written as one, such as every `<metadata>` of a head; the first value of an attribute wins.
function mergedPassthrough(node: TtmlNode, elements: readonly Element[]): Passthrough | undefined {
  const captured = elements.flatMap((element) => nodePassthrough(node, element) ?? []);
  const named = new Map<string, XmlAttr>();
  for (const attr of captured.flatMap((kept) => kept.attrs ?? [])) if (!named.has(attr[0])) named.set(attr[0], attr);
  const attrs = [...named.values()];
  const children = captured.flatMap((kept) => kept.elements ?? []);
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(children.length > 0 && { elements: children }) });
}

const childrenNamed = (parent: Element | undefined, name: string) =>
  parent ? Array.from(parent.children).filter((child) => child.tagName === name) : [];

// -- Document -----------------------------------------------------------------

function docPassthrough(doc: Document, lineByParagraph: ReadonlyMap<Element, LyricLine>): DocPassthrough {
  const root = doc.documentElement;
  const [head] = childrenNamed(root, "head");
  const [body] = childrenNamed(root, "body");
  const iTunesMetadata =
    doc.getElementsByTagName("iTunesMetadata")[0] ?? doc.getElementsByTagNameNS(ITUNES_NS, "iTunesMetadata")[0];
  const captured: [keyof DocPassthrough, Passthrough | undefined][] = [
    ["tt", nodePassthrough("tt", root, {}, rootAnchors)],
    ["head", head && nodePassthrough("head", head)],
    ["metadata", mergedPassthrough("metadata", childrenNamed(head, "metadata"))],
    ["iTunesMetadata", iTunesMetadata && nodePassthrough("iTunesMetadata", iTunesMetadata)],
    ["body", body && nodePassthrough("body", body, {}, sectionAnchors(lineByParagraph))],
  ];
  return Object.fromEntries(captured.filter(([, kept]) => kept !== undefined));
}

// -- Agents -------------------------------------------------------------------

// A node whose text Composer reads, such as a singer name: its attributes, and its children whole when they hold
// elements.
function mixedContentPassthrough(node: TtmlNode, element: Element): Passthrough | undefined {
  const attrs = xmlAttrsFromDom(element, (attr) => !isModelledAttribute(node, attr));
  const markup = element.children.length > 0 ? xmlChildrenFromDom(element) : undefined;
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(markup && { markup }) });
}

function withAgentCapture(agent: Agent, element: Element, nameElement: Element | undefined): Agent {
  const passthrough = nodePassthrough("agent", element);
  const namePassthrough = nameElement && mixedContentPassthrough("agentName", nameElement);
  return { ...agent, ...(passthrough && { passthrough }), ...(namePassthrough && { namePassthrough }) };
}

// -- Lines --------------------------------------------------------------------

const withTimes = (times: Passthrough["times"]) => (times ? { times } : {});

// A `<p>` and its x-bg container: unmodelled data, and their own times when the writer would not derive them.
function withParagraphCapture(line: LyricLine, paragraph: Element, background: Element | null): LyricLine {
  const kept = nodePassthrough(
    "p",
    paragraph,
    withTimes(capturedTimes(paragraph, lineEnvelope(line), true)),
    trackAnchors(paragraph, timedSyllables(mainTrack(line)), true),
  );
  const keptBackground =
    background &&
    nodePassthrough(
      "background",
      background,
      withTimes(capturedTimes(background, backgroundEnvelope(line), false)),
      trackAnchors(background, timedSyllables(backgroundTrack(line)), false),
    );
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

export {
  docPassthrough,
  mixedContentPassthrough,
  nodePassthrough,
  syllableCapture,
  withAgentCapture,
  withParagraphCapture,
};
