import { COMPOSER_NAMESPACES } from "@/utils/lyrics-parsers/composer-namespace";

// -- Types --------------------------------------------------------------------

// The TTML nodes whose unmodelled attributes and children Composer keeps.
type TtmlNode =
  | "tt"
  | "head"
  | "metadata"
  | "iTunesMetadata"
  | "agent"
  | "agentName"
  | "body"
  | "div"
  | "p"
  | "background"
  | "syllable";

// -- Constants ----------------------------------------------------------------

const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";
const TTM_NS = "http://www.w3.org/ns/ttml#metadata";
const UNBOUND_NAMESPACE_PREFIX = "urn:composer:unbound:";

// The prefixes Composer declares on every export.
const COMPOSER_WRITTEN_PREFIXES = ["ttm", "ttp", "itunes", "composer"];

// Attributes Composer reads or writes, by qualified name.
const MODELLED_ATTRIBUTES: Readonly<Record<TtmlNode, ReadonlySet<string>>> = {
  tt: new Set([
    "xmlns",
    ...COMPOSER_WRITTEN_PREFIXES.map((prefix) => `xmlns:${prefix}`),
    "ttp:timeBase",
    "xml:lang",
    "itunes:timing",
    "composer:timing",
  ]),
  head: new Set(),
  metadata: new Set(),
  iTunesMetadata: new Set(["xmlns"]),
  agent: new Set(["xml:id", "type"]),
  agentName: new Set(),
  body: new Set(["dur"]),
  div: new Set(["begin", "end", "itunes:songPart"]),
  p: new Set(["begin", "end", "itunes:key", "ttm:agent"]),
  background: new Set(["ttm:role", "begin", "end"]),
  syllable: new Set(["begin", "end"]),
};

const EXPLICIT_FLAG_NAMES: ReadonlySet<string> = new Set(["explicit", "obscene"]);
const METADATA_ELEMENTS: ReadonlySet<string> = new Set(["ttm:title", "title", "ttm:agent", "amll:meta"]);
const ITUNES_METADATA_ELEMENTS: ReadonlySet<string> = new Set(["translations", "transliterations"]);
const LYRIC_ROLES: ReadonlySet<string> = new Set(["x-bg", "x-translation", "x-roman"]);

// -- Helpers ------------------------------------------------------------------

const isComposerNamespace = (uri: string | null) => uri !== null && COMPOSER_NAMESPACES.includes(uri);

const inComposerNamespace = (node: Attr | Element) =>
  isComposerNamespace(node.namespaceURI) || node.prefix === "composer";

function elementRole(element: Element): string | null {
  return element.getAttribute("ttm:role") || element.getAttributeNS(TTM_NS, "role");
}

// A span the reader takes as a timed syllable of its parent.
function isTimedWordSpan(element: Element): boolean {
  return (
    element.tagName.toLowerCase() === "span" &&
    element.hasAttribute("begin") &&
    elementRole(element) !== "x-bg" &&
    (element.textContent ?? "").trim() !== ""
  );
}

// An element whose text a line without timed syllables reads as lyric text.
function isLyricTextElement(element: Element): boolean {
  return element.tagName.toLowerCase() === "span";
}

// A section the reader takes lines from, or one with nothing to keep.
function isLyricSection(element: Element): boolean {
  if (element.tagName !== "div") return false;
  if (element.getElementsByTagName("p").length > 0) return true;
  return element.attributes.length === 0 && element.children.length === 0;
}

// A paragraph or background container with timed syllables; without them, its spans are lyric text.
function hasTimedWordSpans(container: Element): boolean {
  return Array.from(container.children).some(isTimedWordSpan);
}

// -- Functions ----------------------------------------------------------------

function isModelledAttribute(node: TtmlNode, attr: Attr): boolean {
  if (MODELLED_ATTRIBUTES[node].has(attr.name) || inComposerNamespace(attr)) return true;
  if (attr.prefix === "xmlns")
    return isComposerNamespace(attr.value) || attr.value.startsWith(UNBOUND_NAMESPACE_PREFIX);
  if (node === "syllable") return EXPLICIT_FLAG_NAMES.has(attr.localName.toLowerCase());
  if (node === "p") return attr.namespaceURI === ITUNES_NS && attr.localName === "key";
  if (node === "div") return attr.namespaceURI === ITUNES_NS && attr.localName === "songPart";
  return false;
}

function isModelledChildOf(node: TtmlNode, child: Element, parentHasTimedWords: boolean): boolean {
  if (inComposerNamespace(child)) return true;
  switch (node) {
    case "tt":
      return child.tagName === "head" || child.tagName === "body";
    case "head":
      return child.tagName === "metadata";
    case "metadata":
      return METADATA_ELEMENTS.has(child.tagName) || child.localName === "iTunesMetadata";
    case "iTunesMetadata":
      return ITUNES_METADATA_ELEMENTS.has(child.localName);
    case "agent":
      return child.tagName === "ttm:name";
    case "body":
    case "div":
      return isLyricSection(child) || child.tagName === "p";
    case "p":
    case "background":
      return (
        LYRIC_ROLES.has(elementRole(child) ?? "") ||
        (parentHasTimedWords ? isTimedWordSpan(child) : isLyricTextElement(child))
      );
    default:
      return false;
  }
}

// Whether a child of `parent` is modelled; the parent is read once, not per child.
function modelledChildTest(node: TtmlNode, parent: Element): (child: Element) => boolean {
  const parentHasTimedWords = (node === "p" || node === "background") && hasTimedWordSpans(parent);
  return (child) => isModelledChildOf(node, child, parentHasTimedWords);
}

// -- Exports ------------------------------------------------------------------

export type { TtmlNode };
export {
  COMPOSER_WRITTEN_PREFIXES,
  elementRole,
  ITUNES_NS,
  isLyricTextElement,
  isModelledAttribute,
  isTimedWordSpan,
  LYRIC_ROLES,
  modelledChildTest,
  UNBOUND_NAMESPACE_PREFIX,
};
