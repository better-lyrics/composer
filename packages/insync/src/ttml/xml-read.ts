import { XMLParser } from "fast-xml-parser";
import { withUnixLineBreaks } from "../line-breaks";
import { type XmlReadAttr, type XmlReadCharacters, XmlReadDocument, XmlReadElement } from "./xml-read-tree";
import { xmlWellFormednessError } from "./xml-validate";

// -- Types --------------------------------------------------------------------

type XmlReadResult = { ok: true; doc: XmlReadDocument } | { ok: false; message: string };

type Scope = ReadonlyMap<string | null, string | null>;

// -- Constants ----------------------------------------------------------------

const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

const MAX_ENTITY_EXPANSION = 1_000_000;
const PREDEFINED_ENTITIES: Readonly<Record<string, string>> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const DECLARED_ENTITY = /<!ENTITY\s+([A-Za-z_][\w.-]*)\s+(["'])([\s\S]*?)\2\s*>/g;
const REFERENCE = /&(?:(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z_][\w.-]*);)?/g;
const ATTRIBUTE_WHITESPACE = /[\t\n\r]/g;

const PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  cdataPropName: "#cdata",
  commentPropName: "#comment",
});

const BASE_SCOPE: Scope = new Map([
  ["xml", XML_NS],
  ["xmlns", XMLNS_NS],
]);

// -- Errors -------------------------------------------------------------------

class NotWellFormed extends Error {}

function fail(message: string): never {
  throw new NotWellFormed(message);
}

// -- Entities -----------------------------------------------------------------

class Entities {
  private readonly values: Record<string, string> = { ...PREDEFINED_ENTITIES };
  private remaining = MAX_ENTITY_EXPANSION;

  declare(name: string, value: string): void {
    if (!Object.hasOwn(this.values, name)) this.values[name] = value;
  }

  expand(name: string): string {
    const value = Object.hasOwn(this.values, name) ? this.values[name] : fail(`entity '${name}' is not defined`);
    this.remaining -= value.length;
    return this.remaining >= 0 ? value : fail("entities expand past the size limit");
  }
}

// -- Characters ---------------------------------------------------------------

function isXmlCharacter(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function decodeReferences(raw: string, entities: Entities): string {
  return raw.replace(REFERENCE, (_whole, reference: string | undefined) => {
    if (reference === undefined) fail("an ampersand starts no reference");
    if (!reference.startsWith("#")) return entities.expand(reference);
    const code =
      reference[1] === "x" ? Number.parseInt(reference.slice(2), 16) : Number.parseInt(reference.slice(1), 10);
    return isXmlCharacter(code)
      ? String.fromCodePoint(code)
      : fail(`character reference '${reference}' is not allowed`);
  });
}

// Expanding each value as it is declared means it can refer only to earlier entities, so no cycle can form.
function declaredEntities(source: string): Entities {
  const entities = new Entities();
  for (const [, name, , value] of source.matchAll(DECLARED_ENTITY)) {
    entities.declare(name, decodeReferences(value, entities));
  }
  return entities;
}

// -- Names --------------------------------------------------------------------

function splitName(name: string): [prefix: string | null, localName: string] {
  const parts = name.split(":");
  if (parts.length === 1) return [null, name];
  if (parts.length > 2 || parts.some((part) => part === "")) fail(`'${name}' is not a qualified name`);
  return [parts[0], parts[1]];
}

function scopeOf(attrs: readonly (readonly [string, string])[], parent: Scope): Scope {
  const declarations = attrs.filter(([name]) => name === "xmlns" || name.startsWith("xmlns:"));
  if (declarations.length === 0) return parent;
  const scope = new Map(parent);
  for (const [name, value] of declarations) {
    if (name === "xmlns") scope.set(null, value === "" ? null : value);
    else if (value === "") fail(`prefix '${name.slice(6)}' is bound to no namespace`);
    else scope.set(name.slice(6), value);
  }
  return scope;
}

function resolve(scope: Scope, prefix: string): string {
  const uri = scope.get(prefix);
  return uri ?? fail(`namespace prefix '${prefix}' is not defined`);
}

// -- Building -----------------------------------------------------------------

type ParsedNode = Record<string, unknown>;

const isParsedNode = (value: unknown): value is ParsedNode => typeof value === "object" && value !== null;

function parsedNodes(value: unknown): ParsedNode[] {
  return Array.isArray(value) ? value.filter(isParsedNode) : [];
}

const parsedTagName = (node: ParsedNode) => Object.keys(node).find((key) => key !== ":@") ?? "";

function innerText(node: ParsedNode, key: string): string {
  return parsedNodes(node[key])
    .map((inner) => String(inner["#text"] ?? ""))
    .join("");
}

function rawAttrs(node: ParsedNode): [string, string][] {
  const attrs = node[":@"];
  return isParsedNode(attrs) ? Object.entries(attrs).map(([name, value]) => [name, String(value)]) : [];
}

function decodedAttr([name, raw]: readonly [string, string], entities: Entities): [string, string] {
  if (raw.includes("<")) fail(`attribute '${name}' holds '<'`);
  return [name, decodeReferences(raw.replace(ATTRIBUTE_WHITESPACE, " "), entities)];
}

function readAttr([name, value]: readonly [string, string], scope: Scope): XmlReadAttr {
  if (name === "xmlns") return { name, value, prefix: null, localName: name, namespaceURI: XMLNS_NS };
  const [prefix, localName] = splitName(name);
  return { name, value, prefix, localName, namespaceURI: prefix === null ? null : resolve(scope, prefix) };
}

function readCharacters(node: ParsedNode, entities: Entities): XmlReadCharacters | null {
  if ("#text" in node) {
    const raw = String(node["#text"]);
    if (raw.includes("]]>")) fail("text holds ']]>'");
    return { kind: "text", text: decodeReferences(raw, entities) };
  }
  if ("#cdata" in node) return { kind: "cdata", text: innerText(node, "#cdata") };
  if (!("#comment" in node)) return null;
  const text = innerText(node, "#comment");
  if (text.includes("--") || text.endsWith("-")) fail("a comment holds '--'");
  return { kind: "comment", text };
}

function readElement(
  node: ParsedNode,
  parent: XmlReadElement | null,
  parentScope: Scope,
  entities: Entities,
): XmlReadElement {
  const tagName = parsedTagName(node);
  const attrs = rawAttrs(node).map((attr) => decodedAttr(attr, entities));
  const scope = scopeOf(attrs, parentScope);
  const [prefix, localName] = splitName(tagName);
  if (prefix === "xmlns") fail(`element '${tagName}' uses the xmlns prefix`);
  const namespaceURI = prefix === null ? (scope.get(null) ?? null) : resolve(scope, prefix);
  const attributes = attrs.map((attr) => readAttr(attr, scope));
  const element = new XmlReadElement(tagName, prefix, localName, namespaceURI, attributes, parent);
  for (const child of parsedNodes(node[tagName])) {
    const characters = readCharacters(child, entities);
    const read = characters ?? readElement(child, element, scope, entities);
    element.childNodes.push(read);
    if (read.kind === "element") element.children.push(read);
  }
  return element;
}

// The parser drops text after the last markup, which well-formed XML forbids.
function readRoot(source: string, nodes: readonly ParsedNode[], entities: Entities): XmlReadElement {
  if (source.slice(source.lastIndexOf(">") + 1).trim() !== "") fail("text after the root");
  const elements = nodes.filter((node) => !("#text" in node || "#comment" in node || "#cdata" in node));
  if (elements.length !== 1) fail("the document holds more or less than one root element");
  for (const node of nodes) {
    if ("#cdata" in node || ("#text" in node && String(node["#text"]).trim() !== "")) fail("text outside the root");
  }
  return readElement(elements[0], null, BASE_SCOPE, entities);
}

// -- Functions ----------------------------------------------------------------

function readXmlDocument(source: string): XmlReadResult {
  const normalized = withUnixLineBreaks(source);
  const message = xmlWellFormednessError(normalized);
  if (message !== null) return { ok: false, message };
  try {
    const parsed: unknown = PARSER.parse(normalized);
    const root = readRoot(normalized, parsedNodes(parsed), declaredEntities(normalized));
    return { ok: true, doc: new XmlReadDocument(root) };
  } catch (error) {
    if (error instanceof NotWellFormed) return { ok: false, message: error.message };
    throw error;
  }
}

// -- Exports ------------------------------------------------------------------

export type { XmlReadResult };
export { readXmlDocument };
