import { isWordSynced } from "@/domain/line/predicates";
import { lineIssues, lineView } from "@/domain/mcp/line-view";
import {
  type ToolArgs,
  optionalBoolean,
  optionalInteger,
  optionalString,
  optionalStringList,
} from "@/domain/mcp/tool-args";
import { linesById, requireOpenProject } from "@/lib/mcp/tool-project";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

const DEFAULT_LINE_LIMIT = 50;
const MAX_LINE_LIMIT = 200;

// -- Tools --------------------------------------------------------------------

function getProject(args: ToolArgs): unknown {
  const projectId = requireOpenProject(optionalString(args, "projectId"));
  const { metadata, lines } = useProjectStore.getState();
  const issueCounts: Record<string, number> = {};
  const translationLines: Record<string, number> = {};
  let linesWithIssues = 0;
  let transliteratedLines = 0;
  for (const line of lines) {
    const issues = lineIssues(line);
    if (issues.length > 0) linesWithIssues++;
    for (const issue of issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    if (line.transliteration?.text) transliteratedLines++;
    for (const [language, track] of Object.entries(line.translations ?? {})) {
      if (track.text) translationLines[language] = (translationLines[language] ?? 0) + 1;
    }
  }
  return {
    projectId,
    title: metadata.title,
    artists: metadata.artists,
    album: metadata.album,
    language: metadata.language || null,
    lineCount: lines.length,
    wordSyncedLines: lines.filter(isWordSynced).length,
    transliteration: {
      language: lines.find((line) => line.transliteration)?.transliteration?.language ?? null,
      lines: transliteratedLines,
    },
    translations: translationLines,
    linesWithIssues,
    issueCounts,
  };
}

function getLines(args: ToolArgs): unknown {
  requireOpenProject(optionalString(args, "projectId"));
  const { lines } = useProjectStore.getState();
  const lineIds = optionalStringList(args, "lineIds");
  if (lineIds) linesById(lines, lineIds);
  const wanted = lineIds ? new Set(lineIds) : null;
  const withIssues = optionalBoolean(args, "withIssues");
  const matching = lines
    .map(lineView)
    .filter((view) => (!wanted || wanted.has(view.lineId)) && (!withIssues || view.issues.length > 0));
  const offset = optionalInteger(args, "offset", 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = optionalInteger(args, "limit", DEFAULT_LINE_LIMIT, 1, MAX_LINE_LIMIT);
  const page = matching.slice(offset, offset + limit);
  return {
    total: matching.length,
    offset,
    lines: page,
    ...(offset + page.length < matching.length ? { nextOffset: offset + page.length } : {}),
  };
}

// -- Exports ------------------------------------------------------------------

export { getLines, getProject };
