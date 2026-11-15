import type { Part, PartSection } from "../part";
import type { DocPassthrough, Passthrough } from "../passthrough";
import { escapeXmlAttribute, type XmlAttr, type XmlChild } from "../xml-node";
import type { Agent } from "../agent";
import type { LyricLine } from "../line";
import { COMPOSER_WRITTEN_PREFIXES, UNBOUND_NAMESPACE_PREFIX } from "./modelled";

// -- Types --------------------------------------------------------------------

interface KeptSources {
  passthrough?: DocPassthrough;
  parts: readonly Part[];
  agents: readonly Agent[];
  lines: readonly LyricLine[];
}

// -- Constants ----------------------------------------------------------------

// Prefixes every export declares, and the two XML reserves.
const DECLARED_PREFIXES: ReadonlySet<string> = new Set(["xml", "xmlns", ...COMPOSER_WRITTEN_PREFIXES]);

// Namespaces as the tools that own the prefixes declare them.
const KNOWN_NAMESPACES: Readonly<Record<string, string>> = {
  amll: "http://www.example.com/ns/amll",
  tts: "http://www.w3.org/ns/ttml#styling",
};

// -- Walk ---------------------------------------------------------------------

const prefixOf = (name: string) => (name.includes(":") ? name.slice(0, name.indexOf(":")) : undefined);

const declaredBy = (attrs: readonly XmlAttr[]) =>
  attrs.flatMap(([name]) => (prefixOf(name) === "xmlns" ? [name.slice("xmlns:".length)] : []));

// Prefixes of kept element and attribute names, never of text or values, that no enclosing element declares.
function collectNames(
  attrs: readonly XmlAttr[],
  children: readonly XmlChild[],
  scope: ReadonlySet<string>,
  used: Set<string>,
) {
  const inScope = new Set([...scope, ...declaredBy(attrs)]);
  for (const [name] of attrs) {
    const prefix = prefixOf(name);
    if (prefix && !inScope.has(prefix)) used.add(prefix);
  }
  for (const child of children) {
    if ("text" in child) continue;
    const prefix = prefixOf(child.name);
    const childScope = new Set([...inScope, ...declaredBy(child.attrs)]);
    if (prefix && !childScope.has(prefix)) used.add(prefix);
    collectNames(child.attrs, child.children, childScope, used);
  }
}

function collectKept(kept: Passthrough | undefined, scope: ReadonlySet<string>, used: Set<string>): void {
  if (!kept) return;
  collectNames(kept.attrs ?? [], [...(kept.elements ?? []), ...(kept.markup ?? [])], scope, used);
}

// A part and every section nested in it, at any depth.
function collectSections(sections: readonly PartSection[], scope: ReadonlySet<string>, used: Set<string>): void {
  for (const section of sections) {
    collectKept(section.passthrough, scope, used);
    collectSections(section.sections ?? [], scope, used);
  }
}

function collectLines(lines: readonly LyricLine[], scope: ReadonlySet<string>, used: Set<string>): void {
  for (const line of lines) {
    collectKept(line.passthrough, scope, used);
    for (const track of line.tracks) {
      if (track.role === "bg") collectKept(track.passthrough, scope, used);
      for (const syllable of track.syllables) collectKept(syllable.passthrough, scope, used);
    }
  }
}

// -- Functions ----------------------------------------------------------------

// Declarations for the prefixes kept data uses but the source never declared: known ones first, then the rest the
// way the reader declares them, so a second round trip writes them in the same order.
function keptPrefixDeclarations({ passthrough, parts, agents, lines }: KeptSources): string {
  const scope = new Set([...DECLARED_PREFIXES, ...declaredBy(passthrough?.tt?.attrs ?? [])]);
  const used = new Set<string>();
  for (const each of Object.values(passthrough ?? {})) collectKept(each, scope, used);
  collectSections(parts, scope, used);
  for (const agent of agents) {
    collectKept(agent.passthrough, scope, used);
    collectKept(agent.namePassthrough, scope, used);
  }
  collectLines(lines, scope, used);
  const prefixes = [...used];
  const known = prefixes.filter((prefix) => prefix in KNOWN_NAMESPACES);
  const unknown = prefixes.filter((prefix) => !(prefix in KNOWN_NAMESPACES));
  return [
    ...known.map((prefix) => [prefix, KNOWN_NAMESPACES[prefix]]),
    ...unknown.map((prefix) => [prefix, `${UNBOUND_NAMESPACE_PREFIX}${prefix}`]),
  ]
    .map(([prefix, uri]) => ` xmlns:${prefix}="${escapeXmlAttribute(uri)}"`)
    .join("");
}

// -- Exports ------------------------------------------------------------------

export { keptPrefixDeclarations };
