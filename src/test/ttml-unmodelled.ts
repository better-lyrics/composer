import { writeXmlChild, writeXmlElement } from "insync/xml-node";
import { declareMissingNamespaces } from "@/utils/lyrics-parsers/ttml-helpers";
import {
  elementRole,
  isModelledAttribute,
  isTimedWordSpan,
  modelledChildTest,
  type TtmlNode,
} from "@/utils/lyrics-parsers/ttml-modelled";
import { xmlChildrenFromDom, xmlElementFromDom } from "@/utils/lyrics-parsers/xml-node-from-dom";
import { parseXmlDocument } from "@/utils/xml-document";

// -- Types --------------------------------------------------------------------

// One attribute or element Composer does not model, addressed by the modelled node it hangs on.
interface UnmodelledNode {
  anchor: string;
  kind: "attribute" | "element" | "markup" | "times";
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

// Unmodelled children are listed whole; modelled ones are walked by `visit`.
function childrenOf(
  node: TtmlNode,
  element: Element,
  anchor: string,
  found: Found,
  visit: (child: Element) => void = () => {},
): void {
  const isModelled = modelledChildTest(node, element);
  for (const child of element.children) {
    if (!isModelled(child)) {
      found.push({ anchor, kind: "element", name: child.tagName, value: writeXmlElement(xmlElementFromDom(child)) });
    } else visit(child);
  }
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
  const parsed = parseXmlDocument(declareMissingNamespaces(ttml));
  if (!parsed.ok) throw new Error("TTML is not well formed");
  return parsed.doc;
}

function unmodelledNodes(doc: Document): UnmodelledNode[] {
  return walk(doc, false);
}

const nodeKey = ({ anchor, kind, name, value }: UnmodelledNode) => JSON.stringify([anchor, kind, name, value]);

// What the source carried, unmodelled or as node times, that the export lost.
function missingUnmodelledNodes(source: string, exported: string): UnmodelledNode[] {
  const remaining = new Map<string, number>();
  for (const node of walk(readTtmlDocument(exported), true)) {
    remaining.set(nodeKey(node), (remaining.get(nodeKey(node)) ?? 0) + 1);
  }
  return walk(readTtmlDocument(source), true).filter((node) => {
    const count = remaining.get(nodeKey(node)) ?? 0;
    remaining.set(nodeKey(node), count - 1);
    return count <= 0;
  });
}

// -- Exports ------------------------------------------------------------------

export { missingUnmodelledNodes, readTtmlDocument, unmodelledNodes };
