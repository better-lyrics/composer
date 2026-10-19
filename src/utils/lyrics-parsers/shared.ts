import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { pluralize } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

interface ParseIssue {
  line: number;
  text: string;
  reason: "invalid-timestamp" | "ignored-timestamp" | "unparsed" | "empty-document" | "unsupported-tags";
}

interface ParseResult {
  lines: LyricLine[];
  metadata: Partial<ProjectMetadata>;
  hasTimingData: boolean;
  issues: ParseIssue[];
  agents?: Agent[];
  groups?: LinkGroup[];
  lineKeys?: (string | undefined)[];
}

type ParserFn = (content: string, fallbackDuration?: number) => ParseResult;

// -- Copy ---------------------------------------------------------------------

const UNSUPPORTED_LRC_TAGS_MESSAGE =
  "This LRC uses singer or background vocal tags (v1:, [bg:]) that are not part of LRC. Use a TTML or plain LRC version instead.";

// -- Helpers ------------------------------------------------------------------

function generateLineId(): string {
  return crypto.randomUUID();
}

function skippedLineCount(issues: readonly ParseIssue[]): number {
  return new Set(issues.filter((issue) => issue.reason !== "ignored-timestamp").map((issue) => issue.line)).size;
}

function skippedLinesMessage(skipped: number): string {
  return `${pluralize(skipped, "line")} could not be read.`;
}

function hasUnsupportedTags(issues: readonly ParseIssue[]): boolean {
  return issues.some((issue) => issue.reason === "unsupported-tags");
}

// -- Exports ------------------------------------------------------------------

export { UNSUPPORTED_LRC_TAGS_MESSAGE, generateLineId, hasUnsupportedTags, skippedLineCount, skippedLinesMessage };
export type { ParseIssue, ParseResult, ParserFn };
