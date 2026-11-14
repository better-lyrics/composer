import type { Passthrough } from "insync/passthrough";
import { escapeXmlText, writeXmlAttrs } from "insync/xml-node";
import type { LineTrack, Syllable } from "@/domain/line/model";
import { syllableJoint } from "@/domain/line/text";
import { isTimedSyllable } from "@/domain/line/track";
import { getSplitCharacter, stripSplitCharacter, withoutSplitCharacter } from "@/utils/split-character";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { spanContent } from "@/utils/ttml-markup";

// -- Helpers ------------------------------------------------------------------

const keptOf = (syllable: Syllable): Passthrough | undefined =>
  isTimedSyllable(syllable) ? undefined : syllable.passthrough;

// -- Functions ----------------------------------------------------------------

// A track's text as written without syllable times. Each run of untimed syllables read from one kept span is
// written inside that span again; the space after the run stays outside it.
function untimedTrackContent(track: LineTrack | undefined, text: string): string {
  const syllables = track?.syllables ?? [];
  if (!syllables.some(keptOf)) return escapeXmlText(stripSplitCharacter(text));
  const splitChar = getSplitCharacter();
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

// -- Exports ------------------------------------------------------------------

export { untimedTrackContent };
