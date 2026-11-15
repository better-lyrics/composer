import type { Passthrough } from "../passthrough";
import { escapeXmlText, writeXmlAttrs, type XmlAttr } from "../xml-node";
import type { LineTrack, Syllable } from "../line";
import { syllableJoint } from "../line-text";
import { isTimedSyllable } from "../line-track";
import { withoutSplitCharacter } from "../split-character-text";
import { isStructurallyEqual } from "../structural-equal";
import { spanContent, timedSpan } from "./markup";
import type { Placed } from "./passthrough-write";

// -- Constants ----------------------------------------------------------------

const NO_ELEMENT_ANCHORS: ReadonlySet<string> = new Set();

// -- Helpers ------------------------------------------------------------------

const keptOf = (syllable: Syllable): Passthrough | undefined =>
  isTimedSyllable(syllable) ? undefined : syllable.passthrough;

// -- Functions ----------------------------------------------------------------

// A track's text as written without syllable times, one piece per syllable, each standing for its syllable. Each run
// of untimed syllables read from one kept span is one piece written inside that span again, ending at a syllable a
// kept element follows so the element stays after it; the space after the run stays outside it.
function untimedTrackPieces(
  track: LineTrack | undefined,
  text: string,
  splitChar: string,
  elementAnchors: ReadonlySet<string>,
): Placed<string>[] {
  const syllables = track?.syllables ?? [];
  if (syllables.length === 0) return [{ out: escapeXmlText(withoutSplitCharacter(text, splitChar)), anchors: [] }];
  const joint = (index: number) => withoutSplitCharacter(syllableJoint(syllables, index, splitChar), splitChar);
  const word = (index: number) => withoutSplitCharacter(syllables[index].text, splitChar);
  const pieces: Placed<string>[] = [];
  let index = 0;
  while (index < syllables.length) {
    const kept = keptOf(syllables[index]);
    if (!kept) {
      pieces.push({ out: escapeXmlText(word(index) + joint(index)), anchors: [syllables[index].id] });
      index++;
      continue;
    }
    let last = index;
    while (
      last + 1 < syllables.length &&
      !elementAnchors.has(syllables[last].id) &&
      isStructurallyEqual(keptOf(syllables[last + 1]), kept)
    ) {
      last++;
    }
    let inner = "";
    for (let at = index; at < last; at++) inner += word(at) + joint(at);
    inner += word(last);
    pieces.push({
      out: `<span${writeXmlAttrs(kept.attrs ?? [])}>${spanContent(inner, kept.markup)}</span>${escapeXmlText(joint(last))}`,
      anchors: syllables.slice(index, last + 1).map((syllable) => syllable.id),
    });
    index = last + 1;
  }
  return pieces;
}

function untimedTrackContent(track: LineTrack | undefined, text: string, splitChar: string): string {
  return untimedTrackPieces(track, text, splitChar, NO_ELEMENT_ANCHORS)
    .map((piece) => piece.out)
    .join("");
}

// The attributes of one kept span holding a whole untimed track, when none clash with what a timed span writes.
function wholeTrackKeptAttrs(track: LineTrack | undefined): readonly XmlAttr[] | undefined {
  const syllables = track?.syllables ?? [];
  const kept = syllables.length > 0 ? keptOf(syllables[0]) : undefined;
  if (!kept?.attrs?.length || kept.markup) return undefined;
  if (!syllables.every((syllable) => isStructurallyEqual(keptOf(syllable), kept))) return undefined;
  const clashes = kept.attrs.some(([name]) => name === "begin" || name === "end" || name.startsWith("ttm:"));
  return clashes ? undefined : kept.attrs;
}

// A track written as one timed span without syllable times; a kept span holding all of it gives the timed span its
// attributes instead of nesting inside it, so players never meet a span inside a word.
function untimedTrackSpan(
  word: { begin: number; end: number; explicit?: true },
  track: LineTrack,
  text: string,
  splitChar: string,
) {
  const attrs = wholeTrackKeptAttrs(track);
  return attrs
    ? timedSpan(word, escapeXmlText(withoutSplitCharacter(text, splitChar)), writeXmlAttrs(attrs))
    : timedSpan(word, untimedTrackContent(track, text, splitChar));
}

// -- Exports ------------------------------------------------------------------

export { untimedTrackPieces, untimedTrackSpan };
