import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

type LyricChangeCause = "command" | "undo" | "redo" | "restore" | "preview";

interface LyricChange {
  before: readonly LyricLine[];
  after: readonly LyricLine[];
  cause: LyricChangeCause;
}

interface LyricState {
  lines: readonly LyricLine[];
}

type LyricChangeListener = (change: LyricChange) => void;

// -- State --------------------------------------------------------------------

const listeners = new Set<LyricChangeListener>();

// -- Functions ----------------------------------------------------------------

function onLyricsChanged(listener: LyricChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Every store write that can replace the lines runs through here, so listeners see each change once, after its set.
function writingLyrics<T>(read: () => LyricState, cause: LyricChangeCause, write: () => T): T {
  const before = read().lines;
  const result = write();
  const after = read().lines;
  if (after !== before) for (const listener of listeners) listener({ before, after, cause });
  return result;
}

// -- Exports ------------------------------------------------------------------

export type { LyricChange, LyricChangeCause };
export { onLyricsChanged, writingLyrics };
