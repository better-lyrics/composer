import { type LyricsWriterInput, type WritableLine, songTags, writableLines } from "@/utils/lyrics-writers/shared";

// -- Constants ----------------------------------------------------------------

const CENTISECONDS_PER_SECOND = 100;
const CENTISECONDS_PER_MINUTE = 6000;
// LRC has no line end, so a reader runs each line until the next one; a silence
// at least this long gets an empty timestamp so the line stops on time.
const MIN_MARKED_GAP_SECONDS = 1;

// -- Helpers ------------------------------------------------------------------

function lrcClock(seconds: number): string {
  const centiseconds = Math.round(seconds * CENTISECONDS_PER_SECOND);
  const minutes = Math.floor(centiseconds / CENTISECONDS_PER_MINUTE);
  const wholeSeconds = Math.floor((centiseconds % CENTISECONDS_PER_MINUTE) / CENTISECONDS_PER_SECOND);
  const fraction = centiseconds % CENTISECONDS_PER_SECOND;
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

function lineBody(line: WritableLine): string {
  if (!line.hasWordTiming) return line.text;
  const tagged = line.words.map((word) => `<${lrcClock(word.begin)}>${word.text}`).join("");
  return `${tagged}<${lrcClock(line.words.at(-1)?.end ?? line.bounds.end)}>`;
}

// -- Writer -------------------------------------------------------------------

function writeLrc({ metadata, lines }: LyricsWriterInput): string {
  const writable = writableLines(lines);
  const body = writable.flatMap((line, index) => {
    const entry = `[${lrcClock(line.bounds.begin)}]${lineBody(line)}`;
    const next = writable[index + 1];
    const needsEndMarker = !next || next.bounds.begin - line.bounds.end >= MIN_MARKED_GAP_SECONDS;
    return needsEndMarker ? [entry, `[${lrcClock(line.bounds.end)}]`] : [entry];
  });
  return [...songTags(metadata), ...body].join("\n");
}

// -- Exports ------------------------------------------------------------------

export { writeLrc };
