import type { Part } from "insync/part";
import type { DocPassthrough } from "insync/passthrough";
import { escapeXmlAttribute } from "insync/xml-node";
import type { Agent } from "insync/agent";
import type { LinkGroup } from "insync/group";
import type { LyricLine } from "insync/line";
import { syncProgress } from "@/domain/line/sync-progress";
import { normalizeLanguageTag } from "@/domain/project/language";
import type { ProjectMetadata } from "insync/metadata";
import { YOUTUBE_VIDEO_ID_KEY } from "@/domain/project/metadata-ttml";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { type TimingGranularity, timingGranularityOf } from "@/domain/project/timing-granularity";
import { COMPOSER_NS } from "@/utils/lyrics-parsers/composer-namespace";
import { BODY_ANCHOR, HEAD_ANCHOR } from "@/utils/lyrics-parsers/ttml-anchors";
import { ITUNES_NS } from "@/utils/lyrics-parsers/ttml-modelled";
import { bodyLines } from "@/utils/ttml-body";
import { headLines } from "@/utils/ttml-head";
import { keptPrefixDeclarations } from "@/utils/ttml-kept-prefixes";
import { keyedExportLines } from "@/utils/ttml-line-keys";
import { keptAmongLines, keptAttributes } from "@/utils/ttml-passthrough-write";

// -- Generator ----------------------------------------------------------------

interface TTMLOptions {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups?: LinkGroup[];
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
  minify?: boolean;
  duration?: number;
  timing?: TimingGranularity;
  youtubeVideoId?: string;
}

function generateTTML({
  metadata,
  agents,
  lines,
  groups,
  parts: songParts = [],
  passthrough,
  minify = false,
  duration,
  timing,
  youtubeVideoId,
}: TTMLOptions): string {
  const nl = minify ? "" : "\n";
  const ind = (n: number) => (minify ? "" : "  ".repeat(n));

  const writesWords = timing !== "line";
  const timingValue = writesWords && timingGranularityOf(lines) === "word" ? "Word" : "Line";

  const parts: string[] = [];
  const keyedLines = keyedExportLines(lines);
  const keyById = new Map(keyedLines.map(({ line, key }) => [line.id, key]));

  const language = normalizeLanguageTag(metadata.language ?? "");
  const langAttr = language ? ` xml:lang="${escapeXmlAttribute(language)}"` : "";

  // Apple Music lyric dialect, not strict W3C TTML1. Absolute span times and the
  // Apple timestamp shape are intentional; don't "fix" them to generic TTML.
  parts.push(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:itunes="${ITUNES_NS}" xmlns:composer="${COMPOSER_NS}" ttp:timeBase="media"${langAttr} itunes:timing="${timingValue}" composer:timing="${timingValue}"${keptAttributes(passthrough?.tt)}${keptPrefixDeclarations({ passthrough, parts: songParts, agents, lines })}>`,
  );

  const head = headLines({ metadata, agents, groups, keyedLines, writesWords, youtubeVideoId, passthrough }, ind);
  const body = bodyLines({ lines, keyById, writesWords, duration, parts: songParts, passthrough }, ind);
  const units = [
    { out: head, anchors: [HEAD_ANCHOR] },
    { out: body, anchors: [BODY_ANCHOR] },
  ];
  parts.push(...keptAmongLines(units, passthrough?.tt, ind(1), [HEAD_ANCHOR, BODY_ANCHOR]), "</tt>");

  return parts.join(nl);
}

type ProjectTtmlSource = Pick<TTMLOptions, "metadata" | "agents" | "lines" | "groups" | "parts" | "passthrough">;

function generateProjectTtml(
  { metadata, agents, lines, groups, parts, passthrough }: ProjectTtmlSource,
  duration: number,
  timing?: TimingGranularity,
  youtubeVideoId?: string,
): string {
  return syncProgress(lines, "line").done > 0
    ? generateTTML({ metadata, agents, lines, groups, parts, passthrough, duration, timing, youtubeVideoId })
    : "";
}

const BODY_DURATION = /<body dur="[^"]*"/;
const YOUTUBE_VIDEO_ID_META = new RegExp(`\\s*<composer:meta key="${YOUTUBE_VIDEO_ID_KEY}" value="[^"]*"/>`);

// Duration and video ID describe the loaded audio, so swapping audio never reads as an edit.
function withoutAudioIdentity(ttml: string): string {
  return ttml.replace(BODY_DURATION, "<body").replace(YOUTUBE_VIDEO_ID_META, "");
}

function generateLineTtml(line: LyricLine): string {
  return generateTTML({ metadata: normalizeLoadedMetadata(null), agents: [], lines: [line], minify: true });
}

// -- Exports ------------------------------------------------------------------

export { generateLineTtml, generateProjectTtml, generateTTML, withoutAudioIdentity };
