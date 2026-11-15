import type { LineTrack, LyricLine, Syllable } from "insync/line";
import { backgroundTrack, isTimedSyllable, mainTrack } from "insync/line-track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";

// -- Functions ----------------------------------------------------------------

function withKeptIdentity<S extends Syllable>(syllable: S, kept: Syllable): S {
  return kept.passthrough ? { ...syllable, id: kept.id, passthrough: kept.passthrough } : { ...syllable, id: kept.id };
}

function sameUntimedText(next: LineTrack, kept: LineTrack): boolean {
  return (
    next.syllables.length === kept.syllables.length &&
    next.syllables.every(
      (syllable, index) =>
        isTimedSyllable(syllable) ||
        (!isTimedSyllable(kept.syllables[index]) && kept.syllables[index].text === syllable.text),
    )
  );
}

function withUntimedIdsOfTrack<T extends LineTrack>(next: T, kept: LineTrack | undefined): T {
  if (!kept || !sameUntimedText(next, kept)) return next;
  const syllables = next.syllables.map((syllable, index) =>
    isTimedSyllable(syllable) ? syllable : withKeptIdentity(syllable, kept.syllables[index]),
  );
  return { ...next, syllables };
}

// A line rebuilt from flat fields keeps the ids of the untimed syllables it rebuilt in the same places.
function withUntimedIdsOf(next: LyricLine, kept: LyricLine): LyricLine {
  const main = withUntimedIdsOfTrack(mainTrack(next), mainTrack(kept));
  const background = backgroundTrack(next);
  const keptBackground = background && withUntimedIdsOfTrack(background, backgroundTrack(kept));
  return withBackgroundTrack(withMainTrack(next, main), keptBackground);
}

// -- Exports ------------------------------------------------------------------

export { withUntimedIdsOf };
