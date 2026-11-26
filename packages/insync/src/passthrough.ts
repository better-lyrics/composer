import type { XmlAttr, XmlChild, XmlElement } from "./xml-node";

// -- Types --------------------------------------------------------------------

// A node's own times, either or both, kept while the envelope its content derives still formats to `envelope`.
interface KeptTimes {
  readonly begin?: string;
  readonly end?: string;
  readonly envelope: readonly [string, string];
}

// What a TTML node carried that Composer does not model, written back where it was read.
interface Passthrough {
  readonly attrs?: readonly XmlAttr[];
  readonly elements?: readonly XmlElement[];
  // Per kept element, the anchor it followed (a line, syllable or track part), null when it came first; absent when
  // every one followed the last anchor.
  readonly elementsAfter?: readonly (string | null)[];
  readonly times?: KeptTimes;
  // Syllables and singer names only: the children of a node that holds elements, such as ruby.
  readonly markup?: readonly XmlChild[];
}

interface DocPassthrough {
  readonly tt?: Passthrough;
  readonly head?: Passthrough;
  readonly metadata?: Passthrough;
  readonly iTunesMetadata?: Passthrough;
  readonly body?: Passthrough;
}

// -- Constants ----------------------------------------------------------------

const DOC_NODES = ["tt", "head", "metadata", "iTunesMetadata", "body"] as const;

// -- Emptiness ----------------------------------------------------------------

function isEmptyPassthrough(kept: Passthrough | undefined): boolean {
  return !kept || (!kept.attrs?.length && !kept.elements?.length && !kept.markup?.length && !kept.times);
}

function isEmptyDocPassthrough(kept: DocPassthrough | undefined): boolean {
  return !kept || DOC_NODES.every((node) => isEmptyPassthrough(kept[node]));
}

// -- Times --------------------------------------------------------------------

function keptTimes(
  kept: KeptTimes,
  envelope: readonly [string, string],
): readonly [string | undefined, string | undefined] | null {
  return kept.envelope[0] === envelope[0] && kept.envelope[1] === envelope[1] ? [kept.begin, kept.end] : null;
}

// -- Anchors ------------------------------------------------------------------

// The same kept data with each anchor `rename` knows renamed, as when a merge gives lines or syllables other ids.
function withRenamedAnchors(kept: Passthrough, rename: ReadonlyMap<string, string>): Passthrough {
  if (!kept.elementsAfter) return kept;
  return {
    ...kept,
    elementsAfter: kept.elementsAfter.map((anchor) => (anchor === null ? null : (rename.get(anchor) ?? anchor))),
  };
}

// -- Exports ------------------------------------------------------------------

export type { DocPassthrough, KeptTimes, Passthrough };
export { isEmptyDocPassthrough, isEmptyPassthrough, keptTimes, withRenamedAnchors };
