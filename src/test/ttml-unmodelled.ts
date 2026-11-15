import { writeXmlChild, writeXmlElement } from "insync/xml-node";
import { importableMetadata } from "@/domain/project/imported-metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { parseTtmlDocument } from "@/utils/lyrics-parsers/ttml-helpers";
import {
  elementRole,
  isModelledAttribute,
  isTimedWordSpan,
  LYRIC_ROLES,
  modelledChildTest,
  type TtmlNode,
} from "@/utils/lyrics-parsers/ttml-modelled";
import { xmlChildrenFromDom, xmlElementFromDom } from "@/utils/lyrics-parsers/xml-node-from-dom";
import { generateTTML } from "@/utils/ttml";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Types --------------------------------------------------------------------

// One attribute or element Composer does not model, addressed by the modelled node it hangs on.
interface UnmodelledNode {
  anchor: string;
  kind: "attribute" | "element" | "markup" | "times" | "order";
  name: string;
  value: string;
}

type Found = UnmodelledNode[];

// -- Walk ---------------------------------------------------------------------

function attributesOf(node: TtmlNode, element: Element, anchor: string, found: Found): void {
  for (const attr of element.attributes) {
    if (!isModelledAttribute(node, attr)) found.push({ anchor, kind: "attribute", name: attr.name, value: attr.value });
  }
}

// What a modelled child stands for in its container's order, keyed by its lyric so it compares across a round trip.
function unitsOf(node: TtmlNode, child: Element): string[] {
  switch (node) {
    case "tt":
      return [child.tagName];
    case "body":
    case "div":
      return (child.tagName === "p" ? [child] : Array.from(child.getElementsByTagName("p"))).map(
        (p) => `p:${lyricKey(p)}`,
      );
    case "p":
    case "background":
      if (elementRole(child) === "x-bg") return ["x-bg"];
      return isTimedWordSpan(child) ? [`span:${withoutSpaces(child.textContent ?? "")}`] : [];
    default:
      return [];
  }
}

const withoutSpaces = (text: string) => [...text].filter((character) => character.trim() !== "").join("");

// The lyric a `<p>` spells, without its background, translations or kept elements.
function lyricKey(p: Element): string {
  const isModelled = modelledChildTest("p", p);
  let text = "";
  for (const child of p.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? "";
    const element = child as Element;
    if (child.nodeType === Node.ELEMENT_NODE && isModelled(element) && !LYRIC_ROLES.has(elementRole(element) ?? "")) {
      text += element.textContent ?? "";
    }
  }
  return withoutSpaces(text);
}

const ORDERED_NODES: ReadonlySet<TtmlNode> = new Set(["tt", "body", "div", "p", "background"]);

// Unmodelled children are listed whole, and their order among the modelled ones once per container; modelled ones
// are walked by `visit`.
function childrenOf(
  node: TtmlNode,
  element: Element,
  anchor: string,
  found: Found,
  visit: (child: Element) => void = () => {},
): void {
  const isModelled = modelledChildTest(node, element);
  const order: string[] = [];
  for (const child of element.children) {
    if (!isModelled(child)) {
      const value = writeXmlElement(xmlElementFromDom(child));
      found.push({ anchor, kind: "element", name: child.tagName, value });
      order.push(`kept:${value}`);
    } else {
      order.push(...unitsOf(node, child));
      visit(child);
    }
  }
  if (ORDERED_NODES.has(node)) found.push({ anchor, kind: "order", name: node, value: JSON.stringify(order) });
}

function nodeOf(node: TtmlNode, element: Element, anchor: string, found: Found, visit?: (child: Element) => void) {
  attributesOf(node, element, anchor, found);
  childrenOf(node, element, anchor, found, visit);
}

function syllablesOf(container: Element, anchor: string, found: Found): void {
  Array.from(container.children)
    .filter(isTimedWordSpan)
    .forEach((span, index) => {
      const at = `${anchor}/span[${index}]`;
      attributesOf("syllable", span, at, found);
      if (span.children.length === 0) return;
      const markup = xmlChildrenFromDom(span).map(writeXmlChild).join("");
      found.push({ anchor: at, kind: "markup", name: span.tagName, value: markup });
    });
}

function timesOf(element: Element, anchor: string, found: Found): void {
  for (const name of ["begin", "end"]) {
    const value = element.getAttribute(name);
    if (value !== null) found.push({ anchor, kind: "times", name, value });
  }
}

function paragraphOf(p: Element, anchor: string, found: Found, withTimes: boolean): void {
  if (withTimes) timesOf(p, anchor, found);
  nodeOf("p", p, anchor, found, (child) => {
    if (elementRole(child) !== "x-bg") return;
    if (withTimes) timesOf(child, `${anchor}/x-bg`, found);
    nodeOf("background", child, `${anchor}/x-bg`, found);
    syllablesOf(child, `${anchor}/x-bg`, found);
  });
  syllablesOf(p, anchor, found);
}

function headOf(head: Element, found: Found): void {
  nodeOf("head", head, "head", found, (metadata) =>
    nodeOf("metadata", metadata, "metadata", found, (child) => {
      if (child.localName === "iTunesMetadata") nodeOf("iTunesMetadata", child, "iTunesMetadata", found);
      if (child.tagName !== "ttm:agent") return;
      const anchor = `agent#${child.getAttribute("xml:id")}`;
      nodeOf("agent", child, anchor, found, (name) => nodeOf("agentName", name, `${anchor}/name`, found));
    }),
  );
}

function walk(doc: Document, withTimes: boolean): Found {
  const found: Found = [];
  const paragraphIndex = new Map<Element, number>(
    Array.from(doc.getElementsByTagName("p")).map((p, index) => [p, index]),
  );
  const anchorOf = (p: Element) => `p[${paragraphIndex.get(p)}]`;
  const root = doc.documentElement;
  // A section is addressed by its first line and its depth, so a nested one keeps its own address.
  const sectionOf = (div: Element, depth = 0): void => {
    const first = div.getElementsByTagName("p")[0];
    const anchor = `div${depth}@${first ? anchorOf(first) : "none"}`;
    if (withTimes) timesOf(div, anchor, found);
    nodeOf("div", div, anchor, found, (child) => {
      if (child.tagName === "p") paragraphOf(child, anchorOf(child), found, withTimes);
      else sectionOf(child, depth + 1);
    });
  };
  nodeOf("tt", root, "tt", found, (child) => {
    if (child.tagName === "head") headOf(child, found);
    if (child.tagName !== "body") return;
    nodeOf("body", child, "body", found, (section) => {
      if (section.tagName === "p") return paragraphOf(section, anchorOf(section), found, withTimes);
      sectionOf(section);
    });
  });
  return withoutRepeatedMetadataAttributes(found);
}

// A head's `<metadata>` blocks are written as one, keeping the first value of each attribute.
function withoutRepeatedMetadataAttributes(found: Found): Found {
  const seen = new Set<string>();
  return found.filter(({ anchor, kind, name }) => {
    if (anchor !== "metadata" || kind !== "attribute") return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

// -- Functions ----------------------------------------------------------------

function readTtmlDocument(ttml: string): Document {
  const parsed = parseTtmlDocument(ttml);
  if (!parsed.ok) throw new Error("TTML is not well formed");
  return parsed.doc;
}

function unmodelledNodes(doc: Document): UnmodelledNode[] {
  return walk(doc, false).filter((node) => node.kind !== "order");
}

const nodeKey = ({ anchor, kind, name, value }: UnmodelledNode) => JSON.stringify([anchor, kind, name, value]);

// The kept elements and the lyric units both orders share; units only one side has (a line the export leaves out)
// do not count.
function sharedOrder(order: readonly string[], other: readonly string[]): string[] {
  const remaining = new Map<string, number>();
  for (const unit of other) remaining.set(unit, (remaining.get(unit) ?? 0) + 1);
  return order.filter((unit) => {
    if (unit.startsWith("kept:")) return true;
    const count = remaining.get(unit) ?? 0;
    remaining.set(unit, count - 1);
    return count > 0;
  });
}

// A container whose kept elements no longer stand where they stood among its lyric.
function misplaced(sourceNodes: Found, exportedNodes: Found): Found {
  const exportedOrder = new Map(
    exportedNodes.flatMap((node) => (node.kind === "order" ? [[node.anchor, node.value] as const] : [])),
  );
  return sourceNodes.filter((node) => {
    const exported = exportedOrder.get(node.anchor);
    if (node.kind !== "order" || exported === undefined) return false;
    const [source, written]: string[][] = [JSON.parse(node.value), JSON.parse(exported)];
    return JSON.stringify(sharedOrder(source, written)) !== JSON.stringify(sharedOrder(written, source));
  });
}

// What the source carried, unmodelled or as node times, that the export lost or moved.
function missingUnmodelledNodes(source: string, exported: string): UnmodelledNode[] {
  const [sourceNodes, exportedNodes] = [walk(readTtmlDocument(source), true), walk(readTtmlDocument(exported), true)];
  const remaining = new Map<string, number>();
  for (const node of exportedNodes) {
    if (node.kind !== "order") remaining.set(nodeKey(node), (remaining.get(nodeKey(node)) ?? 0) + 1);
  }
  const lost = sourceNodes.filter((node) => {
    if (node.kind === "order") return false;
    const count = remaining.get(nodeKey(node)) ?? 0;
    remaining.set(nodeKey(node), count - 1);
    return count <= 0;
  });
  return [...lost, ...misplaced(sourceNodes, exportedNodes)];
}

// The export of a file opened as a new project.
function exportOfImport(source: string): string {
  const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
  return generateTTML({
    metadata: normalizeLoadedMetadata(importableMetadata(parsed.metadata)),
    agents: parsed.agents ?? [],
    lines: parsed.lines,
    groups: parsed.groups ?? [],
    parts: parsed.parts,
    passthrough: parsed.passthrough,
    splitChar: DEFAULT_SPLIT_CHARACTER,
  });
}

// -- Exports ------------------------------------------------------------------

export { exportOfImport, missingUnmodelledNodes, readTtmlDocument, unmodelledNodes };
