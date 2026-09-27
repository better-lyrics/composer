import { hasAnyTiming } from "@/domain/line/predicates";
import { reconcileLine, type LooseLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";
import { DEFAULT_MIN_WORD_DURATION } from "@/utils/word-spaces";
import { generateLineId, type ParseIssue, type ParseResult } from "@/utils/lyrics-parsers/shared";

// -- Constants ----------------------------------------------------------------

const CLOCK = String.raw`(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?`;
const LINE_TIMESTAMP_REGEX = new RegExp(String.raw`\[${CLOCK}\]`, "g");
const INLINE_WORD_TAG_REGEX = new RegExp(`<${CLOCK}>`, "g");
const LENGTH_REGEX = new RegExp(`^${CLOCK}$`);
const LRC_METADATA_TAG_REGEX = /^\[([a-z]+):(.*)\]$/i;
const PENDING_WORD_END = -1;
const SECONDS_PER_MINUTE = 60;

// -- Helpers ------------------------------------------------------------------

function parseLrcClock(minutes: string, seconds: string, fraction?: string): number | null {
  const s = Number.parseInt(seconds, 10);
  if (s >= SECONDS_PER_MINUTE) return null;
  const milli = fraction ? Number.parseInt(fraction.padEnd(3, "0"), 10) : 0;
  return Number.parseInt(minutes, 10) * SECONDS_PER_MINUTE + s + milli / 1000;
}

interface InlineWordParseResult {
  cleanText: string;
  words: WordTiming[];
}

function parseInlineWordTags(text: string, lineBegin: number): InlineWordParseResult | "invalid" | null {
  const markers: { timestamp: number; matchStart: number; matchEnd: number }[] = [];
  for (const match of text.matchAll(INLINE_WORD_TAG_REGEX)) {
    const timestamp = parseLrcClock(match[1], match[2], match[3]);
    if (timestamp === null) return "invalid";
    markers.push({ timestamp, matchStart: match.index, matchEnd: match.index + match[0].length });
  }

  if (markers.length === 0) return null;

  const words: WordTiming[] = [];

  const leadingText = text.substring(0, markers[0].matchStart);
  if (leadingText.trim().length > 0) {
    words.push({ text: leadingText, begin: lineBegin, end: markers[0].timestamp });
  }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const nextMarker = markers[i + 1];
    const segmentStart = marker.matchEnd;
    const segmentEnd = nextMarker ? nextMarker.matchStart : text.length;
    const wordText = text.substring(segmentStart, segmentEnd);
    if (wordText.length === 0) continue;
    words.push({
      text: wordText,
      begin: marker.timestamp,
      end: nextMarker ? nextMarker.timestamp : PENDING_WORD_END,
    });
  }

  if (words.length === 0) return null;

  return { cleanText: reconstructLineText(words, getSplitCharacter()), words };
}

function applyMetadataTag(metadata: Partial<ProjectMetadata>, tag: string, rawValue: string): void {
  const value = rawValue.trim();
  if (!value) return;
  const tagLower = tag.toLowerCase();
  if (tagLower === "ti" || tagLower === "title") {
    metadata.title = value;
  } else if (tagLower === "ar" || tagLower === "artist") {
    metadata.artists = [value];
  } else if (tagLower === "al" || tagLower === "album") {
    metadata.album = value;
  } else if (tagLower === "length") {
    const lengthMatch = value.match(LENGTH_REGEX);
    const duration = lengthMatch ? parseLrcClock(lengthMatch[1], lengthMatch[2], lengthMatch[3]) : null;
    if (duration !== null) metadata.duration = duration;
  }
}

function firstAfter(times: readonly number[], after: number): number | undefined {
  return times.find((time) => time > after);
}

function fillLineEnds(lines: LooseLine[], gapMarkers: number[], songEnd: number | undefined): void {
  lines.sort((a, b) => (a.begin ?? 0) - (b.begin ?? 0));
  gapMarkers.sort((a, b) => a - b);
  for (let i = 0; i < lines.length; i++) {
    const begin = lines[i].begin;
    if (begin === undefined) continue;
    const nextBegin = lines[i + 1]?.begin;
    const gap = firstAfter(gapMarkers, begin);
    lines[i].end = gap !== undefined && (nextBegin === undefined || gap < nextBegin) ? gap : nextBegin;
  }

  // The last line has no following line to source its end from. Prefer an
  // explicit [length:] tag, then the caller-supplied audio duration; if neither
  // is available it stays begin-only and reconcileLine renders it untimed.
  const lastLine = lines[lines.length - 1];
  if (
    lastLine &&
    !lastLine.words &&
    lastLine.begin !== undefined &&
    lastLine.end === undefined &&
    songEnd !== undefined &&
    songEnd > lastLine.begin
  ) {
    lastLine.end = songEnd;
  }

  for (let i = 0; i < lines.length; i++) {
    const words = lines[i].words;
    const lastWord = words?.[words.length - 1];
    if (!lastWord || lastWord.end !== PENDING_WORD_END) continue;
    const candidates = [lines[i].end, lines[i + 1]?.begin, songEnd];
    lastWord.end =
      candidates.find((end) => end !== undefined && end > lastWord.begin) ?? lastWord.begin + DEFAULT_MIN_WORD_DURATION;
  }
}

// -- LRC Parser ---------------------------------------------------------------

function parseLrc(content: string, fallbackDuration?: number): ParseResult {
  const metadata: Partial<ProjectMetadata> = {};
  const lines: LooseLine[] = [];
  const gapMarkers: number[] = [];
  const issues: ParseIssue[] = [];

  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const lineNumber = index + 1;

    const metaMatch = trimmed.match(LRC_METADATA_TAG_REGEX);
    if (metaMatch) {
      applyMetadataTag(metadata, metaMatch[1], metaMatch[2]);
      return;
    }

    const tagMatches = [...trimmed.matchAll(LINE_TIMESTAMP_REGEX)];
    const timestamps = tagMatches.flatMap((match) => {
      const time = parseLrcClock(match[1], match[2], match[3]);
      return time === null ? [] : [time];
    });
    if (tagMatches.length === 0) {
      issues.push({ line: lineNumber, text: trimmed, reason: "unparsed" });
      return;
    }
    if (timestamps.length === 0) {
      issues.push({ line: lineNumber, text: trimmed, reason: "invalid-timestamp" });
      return;
    }
    if (timestamps.length < tagMatches.length) {
      issues.push({ line: lineNumber, text: trimmed, reason: "ignored-timestamp" });
    }

    const textWithoutLineTags = trimmed.replace(LINE_TIMESTAMP_REGEX, "");

    if (timestamps.length === 1) {
      const parsed = parseInlineWordTags(textWithoutLineTags, timestamps[0]);
      if (parsed === "invalid") {
        issues.push({ line: lineNumber, text: trimmed, reason: "invalid-timestamp" });
        return;
      }
      if (parsed) {
        lines.push({
          id: generateLineId(),
          text: parsed.cleanText,
          agentId: "v1",
          begin: timestamps[0],
          words: parsed.words,
        });
        return;
      }
    }

    const cleanText = textWithoutLineTags.replace(INLINE_WORD_TAG_REGEX, "").trim();
    if (!cleanText) {
      gapMarkers.push(...timestamps);
      return;
    }
    for (const begin of timestamps) {
      lines.push({ id: generateLineId(), text: cleanText, agentId: "v1", begin });
    }
  });

  fillLineEnds(lines, gapMarkers, metadata.duration ?? fallbackDuration);

  const reconciledLines = lines.map(reconcileLine);
  return {
    lines: reconciledLines,
    metadata,
    hasTimingData: reconciledLines.some(hasAnyTiming),
    issues,
  };
}

// -- Exports ------------------------------------------------------------------

export { LRC_METADATA_TAG_REGEX, parseLrc, parseLrcClock };
