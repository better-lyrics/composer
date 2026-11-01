import type { Agent } from "@/domain/agent/model";
import { MS_PER_SECOND, readSingerMarker } from "@/utils/lyrics-parsers/qrc-metadata";
import { type LyricsWriterInput, type WritableLine, songTags, writableLines } from "@/utils/lyrics-writers/shared";

// -- Constants ----------------------------------------------------------------

const MARKER_COLON = "：";

// -- Helpers ------------------------------------------------------------------

function ms(seconds: number): number {
  return Math.round(seconds * MS_PER_SECOND);
}

function timeTag(begin: number, end: number): string {
  return `${ms(begin)},${ms(end) - ms(begin)}`;
}

// The QRC parser names a combined voice "A, B"; QQ writes it "A/B".
function markerName(agent: Agent | undefined, agentId: string): string {
  const name = (agent?.name ?? "")
    .split(/\s*,\s*/)
    .join("/")
    .trim();
  return name && readSingerMarker(`${name}${MARKER_COLON}`) ? name : agentId;
}

function lineEntry(line: WritableLine): string {
  const body = line.hasWordTiming
    ? line.words.map((word) => `${word.text}(${timeTag(word.begin, word.end)})`).join("")
    : line.text;
  return `[${timeTag(line.bounds.begin, line.bounds.end)}]${body}`;
}

// -- Writer -------------------------------------------------------------------

function writeQrc({ metadata, agents, lines }: LyricsWriterInput): string {
  const writable = writableLines(lines);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const marksSingers = new Set(writable.map((line) => line.agentId)).size > 1;

  const body = writable.flatMap((line, index) => {
    const entry = lineEntry(line);
    if (!marksSingers || writable[index - 1]?.agentId === line.agentId) return [entry];
    const marker = `[${ms(line.bounds.begin)},0]${markerName(agentsById.get(line.agentId), line.agentId)}${MARKER_COLON}`;
    return [marker, entry];
  });
  return [...songTags(metadata), ...body].join("\n");
}

// -- Exports ------------------------------------------------------------------

export { writeQrc };
