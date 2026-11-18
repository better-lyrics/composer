import type { LineTrack, LyricLine, Syllable } from "./line";
import { backgroundTrack, mainTrack } from "./line-track";
import { memoBySplitCharacter } from "./memo-by-identity";

// -- Functions ----------------------------------------------------------------

// What follows a syllable in the text: its separator, and the split character when it joins the next with no
// whitespace between them (old saves join whole lines, spaces included).
function syllableJoint(syllables: readonly Syllable[], index: number, splitChar: string): string {
  const { sep, joinsNext } = syllables[index];
  return index < syllables.length - 1 && joinsNext && sep.trimEnd() === sep ? sep + splitChar : sep;
}

function syllablesText(syllables: readonly Syllable[], splitChar: string): string {
  let text = "";
  for (let index = 0; index < syllables.length; index++) {
    text += syllables[index].text + syllableJoint(syllables, index, splitChar);
  }
  return text;
}

const trackText = memoBySplitCharacter((track: LineTrack, splitChar: string): string =>
  syllablesText(track.syllables, splitChar),
);

function lineText(line: LyricLine, splitChar: string): string {
  return trackText(mainTrack(line), splitChar);
}

function backgroundText(line: LyricLine | undefined, splitChar: string): string | undefined {
  const background = line && backgroundTrack(line);
  return background && trackText(background, splitChar);
}

// -- Exports ------------------------------------------------------------------

export { backgroundText, lineText, syllableJoint, syllablesText, trackText };
