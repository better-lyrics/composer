import type { LineTrack, LyricLine, Syllable } from "@/domain/line/model";
import { backgroundTrack, mainTrack } from "@/domain/line/track";
import { getSplitCharacter } from "@/utils/split-character";

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

const textByTrack = new WeakMap<LineTrack, { splitChar: string; text: string }>();

function trackText(track: LineTrack, splitChar = getSplitCharacter()): string {
  const cached = textByTrack.get(track);
  if (cached?.splitChar === splitChar) return cached.text;
  const text = syllablesText(track.syllables, splitChar);
  textByTrack.set(track, { splitChar, text });
  return text;
}

function lineText(line: LyricLine): string {
  return trackText(mainTrack(line));
}

function backgroundText(line: LyricLine | undefined): string | undefined {
  const background = line && backgroundTrack(line);
  return background && trackText(background);
}

// -- Exports ------------------------------------------------------------------

export { backgroundText, lineText, syllableJoint, syllablesText, trackText };
