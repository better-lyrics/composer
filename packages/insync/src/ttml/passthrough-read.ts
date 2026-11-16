import {
  storedAttrs,
  storedChildren,
  storedElement,
  type XmlReadDocument,
  type XmlReadElement,
  type XmlReadNode,
} from "./xml-read-tree";
import { type DocPassthrough, isEmptyPassthrough, type Passthrough } from "../passthrough";
import type { XmlElement } from "../xml-node";
import type { Agent } from "../agent";
import type { LyricLine } from "../line";
import { withLinePassthrough } from "../line-passthrough";
import { backgroundTrack, mainTrack, timedSyllables } from "../line-track";
import { type AnchorOf, headAnchors, noAnchors, rootAnchors, sectionAnchors, trackAnchors } from "./anchors";
import { ITUNES_NS, isModelledAttribute, modelledChildTest, type TtmlNode } from "./modelled";
import { backgroundEnvelope, capturedTimes, lineEnvelope } from "./kept-times";
import { markupBaseText } from "./markup";

// -- Capture ------------------------------------------------------------------

function withoutEmpty(kept: Passthrough): Passthrough | undefined {
  return isEmptyPassthrough(kept) ? undefined : kept;
}

// A `<metadata>` after the first, kept whole but for what Composer reads from it and writes in the first.
function laterMetadata(block: XmlReadElement): XmlElement {
  const kept = nodePassthrough("metadata", block);
  return { name: block.tagName, attrs: kept?.attrs ?? [], children: kept?.elements ?? [] };
}

// The unmodelled children of one node, and the anchor each followed when any came before an anchor.
function keptChildren(
  node: TtmlNode,
  element: XmlReadElement,
  anchorOf: AnchorOf,
): Pick<Passthrough, "elements" | "elementsAfter"> {
  const isModelled = modelledChildTest(node, element);
  const elements: XmlElement[] = [];
  const elementsAfter: (string | null)[] = [];
  let last: string | null = null;
  for (const child of element.childNodes) {
    if (child.kind === "element" && !isModelled(child)) {
      elements.push(node === "head" && child.tagName === "metadata" ? laterMetadata(child) : storedElement(child));
      elementsAfter.push(last);
    } else last = anchorOf(child) ?? last;
  }
  if (elements.length === 0) return {};
  return { elements, ...(elementsAfter.some((anchor) => anchor !== last) && { elementsAfter }) };
}

// The unmodelled attributes and children of one node, plus anything the caller adds.
function nodePassthrough(
  node: TtmlNode,
  element: XmlReadElement,
  extra: Passthrough = {},
  anchorOf: AnchorOf = noAnchors,
): Passthrough | undefined {
  const attrs = storedAttrs(element, (attr) => !isModelledAttribute(node, attr));
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...keptChildren(node, element, anchorOf), ...extra });
}

const childrenNamed = (parent: XmlReadElement | undefined, name: string) =>
  parent ? Array.from(parent.children).filter((child) => child.tagName === name) : [];

// -- Document -----------------------------------------------------------------

function docPassthrough(doc: XmlReadDocument, lineByParagraph: ReadonlyMap<XmlReadElement, LyricLine>): DocPassthrough {
  const root = doc.documentElement;
  const [head] = childrenNamed(root, "head");
  const [body] = childrenNamed(root, "body");
  const [metadata] = childrenNamed(head, "metadata");
  const iTunesMetadata =
    doc.getElementsByTagName("iTunesMetadata")[0] ?? doc.getElementsByTagNameNS(ITUNES_NS, "iTunesMetadata")[0];
  const captured: [keyof DocPassthrough, Passthrough | undefined][] = [
    ["tt", nodePassthrough("tt", root, {}, rootAnchors)],
    ["head", head && nodePassthrough("head", head, {}, headAnchors)],
    ["metadata", metadata && nodePassthrough("metadata", metadata)],
    ["iTunesMetadata", iTunesMetadata && nodePassthrough("iTunesMetadata", iTunesMetadata)],
    ["body", body && nodePassthrough("body", body, {}, sectionAnchors(lineByParagraph))],
  ];
  return Object.fromEntries(captured.filter(([, kept]) => kept !== undefined));
}

// -- Agents -------------------------------------------------------------------

// A node whose text Composer reads, such as a singer name: its attributes, and its children whole when they hold
// elements.
function mixedContentPassthrough(node: TtmlNode, element: XmlReadElement): Passthrough | undefined {
  const attrs = storedAttrs(element, (attr) => !isModelledAttribute(node, attr));
  const markup = element.children.length > 0 ? storedChildren(element) : undefined;
  return withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(markup && { markup }) });
}

function withAgentCapture(agent: Agent, element: XmlReadElement, nameElement: XmlReadElement | undefined): Agent {
  const passthrough = nodePassthrough("agent", element);
  const namePassthrough = nameElement && mixedContentPassthrough("agentName", nameElement);
  return { ...agent, ...(passthrough && { passthrough }), ...(namePassthrough && { namePassthrough }) };
}

// -- Lines --------------------------------------------------------------------

const withTimes = (times: Passthrough["times"]) => (times ? { times } : {});

// A `<p>` and its x-bg container: unmodelled data, and their own times when the writer would not derive them.
function withParagraphCapture(
  line: LyricLine,
  paragraph: XmlReadElement,
  background: XmlReadElement | null,
  untimed: { main: ReadonlyMap<XmlReadNode, string>; background: ReadonlyMap<XmlReadNode, string> },
): LyricLine {
  const kept = nodePassthrough(
    "p",
    paragraph,
    withTimes(capturedTimes(paragraph, lineEnvelope(line), true)),
    trackAnchors(paragraph, timedSyllables(mainTrack(line)), true, untimed.main),
  );
  const keptBackground =
    background &&
    nodePassthrough(
      "background",
      background,
      withTimes(capturedTimes(background, backgroundEnvelope(line), false)),
      trackAnchors(background, timedSyllables(backgroundTrack(line)), false, untimed.background),
    );
  if (!kept && !keptBackground) return line;
  return withLinePassthrough(line, {
    ...(kept && { line: kept }),
    ...(keptBackground && { background: keptBackground }),
  });
}

// A timed span's text and unmodelled data; a span holding elements keeps them as markup and spells its base text.
function syllableCapture(span: XmlReadElement): { text: string; passthrough?: Passthrough } {
  const markup = span.children.length > 0 ? storedChildren(span) : undefined;
  const base = markup && markupBaseText(markup);
  const keepsMarkup = base !== undefined && base.trim() !== "";
  const attrs = storedAttrs(span, (attr) => !isModelledAttribute("syllable", attr));
  const passthrough = withoutEmpty({ ...(attrs.length > 0 && { attrs }), ...(keepsMarkup && { markup }) });
  return { text: keepsMarkup ? base : span.textContent, ...(passthrough && { passthrough }) };
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
