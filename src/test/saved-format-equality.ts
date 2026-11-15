import { msFromSeconds, secondsFromMs } from "insync/time";
import type { LanguagePieces } from "insync/language";
import { sidePieces, withPiecesOn } from "@/domain/language/side-pieces";
import type { LineTrack, LyricLine, Syllable } from "insync/line";
import { backgroundTrack, mainTrack } from "insync/line-track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";

// -- Helpers ------------------------------------------------------------------

const wholeMs = (seconds: number) => secondsFromMs(msFromSeconds(seconds));

function syllableInWholeMs(syllable: Syllable): Syllable {
  if (syllable.begin === undefined) return syllable;
  return { ...syllable, begin: wholeMs(syllable.begin), end: wholeMs(syllable.end) };
}

function trackInWholeMs<T extends LineTrack>(track: T): T {
  const syllables = track.syllables.map(syllableInWholeMs);
  if (track.begin === undefined) return { ...track, syllables };
  return { ...track, syllables, begin: wholeMs(track.begin), end: wholeMs(track.end) };
}

// Lines as a format 4 save keeps them: every time rounded to a whole millisecond.
function withTimesInWholeMs(lines: readonly LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    const background = backgroundTrack(line);
    return withBackgroundTrack(
      withMainTrack(line, trackInWholeMs(mainTrack(line))),
      background && trackInWholeMs(background),
    );
  });
}

function trackWithPositionIds<T extends LineTrack>(track: T, renamed: Map<string, string>): T {
  const syllables = track.syllables.map((syllable, index) => {
    const id = `${track.role}#${index}`;
    renamed.set(syllable.id, id);
    return { ...syllable, id };
  });
  return { ...track, syllables };
}

function renamedPieces(pieces: LanguagePieces | undefined, renamed: Map<string, string>): LanguagePieces | undefined {
  return pieces && Object.fromEntries(Object.entries(pieces).map(([id, piece]) => [renamed.get(id) ?? id, piece]));
}

// Two loads mint different syllable ids; this names every syllable by its place so lines compare by content.
function withPositionIds(lines: readonly LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    const renamed = new Map<string, string>();
    const background = backgroundTrack(line);
    const renamedLine = withBackgroundTrack(
      withMainTrack(line, trackWithPositionIds(mainTrack(line), renamed)),
      background && trackWithPositionIds(background, renamed),
    );
    const main = withPiecesOn(line.languages, "main", renamedPieces(sidePieces(line.languages, "main"), renamed));
    const languages = withPiecesOn(main, "bg", renamedPieces(sidePieces(line.languages, "bg"), renamed));
    return languages ? { ...renamedLine, languages } : renamedLine;
  });
}

// -- Exports ------------------------------------------------------------------

export { withPositionIds, withTimesInWholeMs };
