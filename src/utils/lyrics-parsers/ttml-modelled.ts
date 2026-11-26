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
const XML_NS = "http://www.w3.org/XML/1998/namespace";
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

const ownLanguage = (element: Element) =>
  element.getAttribute("xml:lang") || element.getAttributeNS(XML_NS, "lang") || "";

// A span the reader takes as a timed syllable of its parent.
function isTimedWordSpan(element: Element): boolean {
  return (
    element.tagName.toLowerCase() === "span" &&
    element.hasAttribute("begin") &&
    !LYRIC_ROLES.has(elementRole(element) ?? "") &&
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

// -- Inline alternates ---------------------------------------------------------

// A romanization's own language; a translation's own or the nearest one around it.
function inlineLanguage(span: Element): string {
  if (elementRole(span) === "x-roman") return ownLanguage(span) || "und-Latn";
  for (let at: Element | null = span; at; at = at.parentElement) {
    const language = ownLanguage(at);
    if (language) return language;
  }
  return "und";
}

const directWithRole = (container: Element | null | undefined, role: string) =>
  container ? Array.from(container.children).filter((child) => elementRole(child) === role) : [];

function paragraphOf(container: Element): Element | null {
  let at: Element | null = container;
  while (at && at.tagName !== "p") at = at.parentElement;
  return at;
}

// The x-bg container the reader takes a line's background from: the first in the `<p>`.
function backgroundOf(paragraph: Element): Element | undefined {
  return Array.from(paragraph.getElementsByTagName("span")).find((span) => elementRole(span) === "x-bg");
}

const childrenNamed = (parent: Element | undefined, localName: string) =>
  parent ? Array.from(parent.children).filter((child) => child.localName === localName) : [];

// Each line key's romanization language in the `<head>`; the last entry for a key wins, as the head reader reads it.
function headRomanLanguagesOf(doc: Document): ReadonlyMap<string, string> {
  const root =
    doc.getElementsByTagName("iTunesMetadata")[0] ?? doc.getElementsByTagNameNS(ITUNES_NS, "iTunesMetadata")[0];
  const languages = new Map<string, string>();
  for (const container of childrenNamed(childrenNamed(root, "transliterations")[0], "transliteration")) {
    const language = ownLanguage(container) || "und-Latn";
    for (const text of childrenNamed(container, "text")) {
      const key = text.getAttribute("for");
      if (key) languages.set(key, language);
    }
  }
  return languages;
}

const headRomanLanguages = new WeakMap<Document, ReadonlyMap<string, string>>();

function headRomanLanguageOf(paragraph: Element): string | undefined {
  const doc = paragraph.ownerDocument;
  const languages = headRomanLanguages.get(doc) ?? headRomanLanguagesOf(doc);
  headRomanLanguages.set(doc, languages);
  const key = paragraph.getAttribute("itunes:key") ?? paragraph.getAttributeNS(ITUNES_NS, "key");
  return key ? languages.get(key) : undefined;
}

// A line's one romanization language: its `<head>` entry's, else that of its first inline romanization.
function romanLanguageOf(paragraph: Element): string | undefined {
  const [firstInline] = [
    ...directWithRole(paragraph, "x-roman"),
    ...directWithRole(backgroundOf(paragraph), "x-roman"),
  ].map(inlineLanguage);
  return headRomanLanguageOf(paragraph) ?? firstInline;
}

// The inline translations and romanization of a `<p>` or its x-bg container the reader takes, with their language:
// the first translation of each language, and the first romanization in the line's one romanization language. The
// rest are kept as they are.
function readInlineAlternates(container: Element): ReadonlyMap<Element, string> {
  const read = new Map<Element, string>();
  const translated = new Set<string>();
  for (const span of directWithRole(container, "x-translation")) {
    const language = inlineLanguage(span);
    if (translated.has(language)) continue;
    translated.add(language);
    read.set(span, language);
  }
  const paragraph = paragraphOf(container);
  const romanLanguage = paragraph ? romanLanguageOf(paragraph) : undefined;
  const roman = directWithRole(container, "x-roman").find((span) => inlineLanguage(span) === romanLanguage);
  if (roman && romanLanguage) read.set(roman, romanLanguage);
  return read;
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

function isModelledChildOf(
  node: TtmlNode,
  child: Element,
  parentHasTimedWords: boolean,
  readAlternates: ReadonlyMap<Element, string>,
): boolean {
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
    case "background": {
      const role = elementRole(child);
      if (role === "x-bg") return true;
      if (LYRIC_ROLES.has(role ?? "")) return readAlternates.has(child);
      return parentHasTimedWords ? isTimedWordSpan(child) : isLyricTextElement(child);
    }
    default:
      return false;
  }
}

// Whether a child of `parent` is modelled; the parent is read once, not per child.
function modelledChildTest(node: TtmlNode, parent: Element): (child: Element) => boolean {
  const inLine = node === "p" || node === "background";
  const parentHasTimedWords = inLine && hasTimedWordSpans(parent);
  const readAlternates = inLine ? readInlineAlternates(parent) : new Map<Element, string>();
  return (child) => isModelledChildOf(node, child, parentHasTimedWords, readAlternates);
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
  ownLanguage,
  readInlineAlternates,
  UNBOUND_NAMESPACE_PREFIX,
};
