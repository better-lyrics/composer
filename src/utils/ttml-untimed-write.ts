import type { Passthrough } from "insync/passthrough";
import { escapeXmlText, writeXmlAttrs, type XmlAttr } from "insync/xml-node";
import type { LineTrack, Syllable } from "insync/line";
import { syllableJoint } from "@/domain/line/text";
import { isTimedSyllable } from "insync/line-track";
import { withoutSplitCharacter } from "@/utils/split-character-text";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { spanContent, timedSpan } from "@/utils/ttml-markup";

// -- Helpers ------------------------------------------------------------------

const keptOf = (syllable: Syllable): Passthrough | undefined =>
  isTimedSyllable(syllable) ? undefined : syllable.passthrough;

// -- Functions ----------------------------------------------------------------

// A track's text as written without syllable times. Each run of untimed syllables read from one kept span is
// written inside that span again; the space after the run stays outside it.
function untimedTrackContent(track: LineTrack | undefined, text: string, splitChar: string): string {
  const syllables = track?.syllables ?? [];
  if (!syllables.some(keptOf)) return escapeXmlText(withoutSplitCharacter(text, splitChar));
  const joint = (index: number) => withoutSplitCharacter(syllableJoint(syllables, index, splitChar), splitChar);
  const word = (index: number) => withoutSplitCharacter(syllables[index].text, splitChar);
  let content = "";
  let index = 0;
  while (index < syllables.length) {
    const kept = keptOf(syllables[index]);
    if (!kept) {
      content += escapeXmlText(word(index) + joint(index));
      index++;
      continue;
    }
    let last = index;
    while (last + 1 < syllables.length && isStructurallyEqual(keptOf(syllables[last + 1]), kept)) last++;
    let inner = "";
    for (let at = index; at < last; at++) inner += word(at) + joint(at);
    inner += word(last);
    content += `<span${writeXmlAttrs(kept.attrs ?? [])}>${spanContent(inner, kept.markup)}</span>${escapeXmlText(joint(last))}`;
    index = last + 1;
  }
  return content;
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

export { untimedTrackContent, untimedTrackSpan };
