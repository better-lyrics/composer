import { type LyricsWriterInput, writableLines } from "@/utils/lyrics-writers/shared";

// -- Constants ----------------------------------------------------------------

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

// -- Helpers ------------------------------------------------------------------

function srtClock(seconds: number): string {
  const totalMs = Math.round(seconds * MS_PER_SECOND);
  const hours = Math.floor(totalMs / MS_PER_HOUR);
  const minutes = Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const wholeSeconds = Math.floor((totalMs % MS_PER_MINUTE) / MS_PER_SECOND);
  const ms = totalMs % MS_PER_SECOND;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)},${String(ms).padStart(3, "0")}`;
}

// -- Writer -------------------------------------------------------------------

function writeSrt({ lines }: LyricsWriterInput): string {
  return writableLines(lines)
    .map(
      (line, index) => `${index + 1}\n${srtClock(line.bounds.begin)} --> ${srtClock(line.bounds.end)}\n${line.text}\n`,
    )
    .join("\n");
}

// -- Exports ------------------------------------------------------------------

export { writeSrt };
