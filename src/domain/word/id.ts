import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

function newWordId(): string {
  return crypto.randomUUID();
}

// A line-synced line shows one word; its id follows the line so timing edits keep it.
function lineTimingWordId(lineId: string): string {
  return `${lineId}:line`;
}

function withNewId(word: WordTiming): WordTiming {
  return { ...word, id: newWordId() };
}

// The first piece of a split keeps the word's id; the others are new words.
function withSplitIds(pieces: readonly WordTiming[]): WordTiming[] {
  return pieces.map((piece, index) => (index === 0 ? piece : withNewId(piece)));
}

// Words joining a track keep their ids; one the track already holds becomes a new word.
function withFreeIds(incoming: WordTiming[], existing: readonly { id: string }[]): WordTiming[] {
  const taken = new Set(existing.map((word) => word.id));
  let changed = false;
  const result = incoming.map((word) => {
    const free = !taken.has(word.id);
    const placed = free ? word : withNewId(word);
    changed ||= !free;
    taken.add(placed.id);
    return placed;
  });
  return changed ? result : incoming;
}

// A copy into another line keeps that line's ids by position, so its words stay the same words; any other copy
// is new words. Lines never share ids, so words joined from two lines never clash.
function withIdsOf(
  words: WordTiming[] | undefined,
  target: readonly { id: string }[] | undefined,
): WordTiming[] | undefined {
  if (!words) return words;
  return words.map((word, index) => ({
    ...word,
    id: target?.length === words.length ? target[index].id : newWordId(),
  }));
}

// For comparing words by content and timing alone.
function withoutWordIds(words: readonly WordTiming[] | undefined): Omit<WordTiming, "id">[] | undefined {
  return words?.map(({ id: _id, ...word }) => word);
}

// -- Exports ------------------------------------------------------------------

export { lineTimingWordId, newWordId, withFreeIds, withIdsOf, withNewId, withoutWordIds, withSplitIds };
