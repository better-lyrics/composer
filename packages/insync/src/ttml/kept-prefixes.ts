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

// Prefixes kept names use that no enclosing element declares, and the namespace the source declared for each prefix.
interface Found {
  used: Set<string>;
  sourceNamespaces: Map<string, string>;
}

const prefixOf = (name: string) => (name.includes(":") ? name.slice(0, name.indexOf(":")) : undefined);

const declaredBy = (attrs: readonly XmlAttr[]) =>
  attrs.flatMap(([name]) => (prefixOf(name) === "xmlns" ? [name.slice("xmlns:".length)] : []));

const withDeclared = (scope: ReadonlySet<string>, attrs: readonly XmlAttr[] = []) =>
  new Set([...scope, ...declaredBy(attrs)]);

// Prefixes of kept element and attribute names, never of text or values, that no enclosing element declares.
function collectNames(
  attrs: readonly XmlAttr[],
  children: readonly XmlChild[],
  scope: ReadonlySet<string>,
  found: Found,
) {
  const inScope = withDeclared(scope, attrs);
  for (const [name, value] of attrs) {
    const prefix = prefixOf(name);
    if (prefix === "xmlns") {
      const declared = name.slice("xmlns:".length);
      if (!found.sourceNamespaces.has(declared)) found.sourceNamespaces.set(declared, value);
    } else if (prefix && !inScope.has(prefix)) found.used.add(prefix);
  }
  for (const child of children) {
    if ("text" in child) continue;
    const prefix = prefixOf(child.name);
    if (prefix && !withDeclared(inScope, child.attrs).has(prefix)) found.used.add(prefix);
    collectNames(child.attrs, child.children, inScope, found);
  }
}

function collectKept(kept: Passthrough | undefined, scope: ReadonlySet<string>, found: Found): void {
  if (!kept) return;
  collectNames(kept.attrs ?? [], [...(kept.elements ?? []), ...(kept.markup ?? [])], scope, found);
}

// A part and every section nested in it, at any depth.
function collectSections(sections: readonly PartSection[], scope: ReadonlySet<string>, found: Found): void {
  for (const section of sections) {
    collectKept(section.passthrough, scope, found);
    collectSections(section.sections ?? [], scope, found);
  }
}

// Syllables and the background are written inside their line, so the line's own declarations cover them.
function collectLines(lines: readonly LyricLine[], scope: ReadonlySet<string>, found: Found): void {
  for (const line of lines) {
    collectKept(line.passthrough, scope, found);
    const lineScope = withDeclared(scope, line.passthrough?.attrs);
    for (const track of line.tracks) {
      const trackScope = track.role === "bg" ? withDeclared(lineScope, track.passthrough?.attrs) : lineScope;
      if (track.role === "bg") collectKept(track.passthrough, lineScope, found);
      for (const syllable of track.syllables) collectKept(syllable.passthrough, trackScope, found);
    }
  }
}

// -- Functions ----------------------------------------------------------------

// Declarations for the prefixes kept data uses outside every declaration of them: with the namespace the source
// declared for the prefix, else the owning tool's, else one the reader gave a prefix the source never declared.
function keptPrefixDeclarations({ passthrough, parts, agents, lines }: KeptSources): string {
  const scope = new Set([...DECLARED_PREFIXES, ...declaredBy(passthrough?.tt?.attrs ?? [])]);
  const found: Found = { used: new Set(), sourceNamespaces: new Map() };
  for (const each of Object.values(passthrough ?? {})) collectKept(each, scope, found);
  collectSections(parts, scope, found);
  for (const agent of agents) {
    collectKept(agent.passthrough, scope, found);
    collectKept(agent.namePassthrough, scope, found);
  }
  collectLines(lines, scope, found);
  const namespaceOf = (prefix: string) =>
    found.sourceNamespaces.get(prefix) ?? KNOWN_NAMESPACES[prefix] ?? `${UNBOUND_NAMESPACE_PREFIX}${prefix}`;
  const rank = (prefix: string) => (found.sourceNamespaces.has(prefix) || prefix in KNOWN_NAMESPACES ? 0 : 1);
  return [...found.used]
    .toSorted((a, b) => rank(a) - rank(b))
    .map((prefix) => ` xmlns:${prefix}="${escapeXmlAttribute(namespaceOf(prefix))}"`)
    .join("");
}

// -- Exports ------------------------------------------------------------------

export { keptPrefixDeclarations };
