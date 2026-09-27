import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Types --------------------------------------------------------------------

interface ParseIssue {
  line: number;
  text: string;
  reason: "invalid-timestamp" | "ignored-timestamp" | "unparsed" | "empty-document";
}

interface ParseResult {
  lines: LyricLine[];
  metadata: Partial<ProjectMetadata>;
  hasTimingData: boolean;
  issues: ParseIssue[];
  agents?: Agent[];
  groups?: LinkGroup[];
}

type ParserFn = (content: string, fallbackDuration?: number) => ParseResult;

// -- Helpers ------------------------------------------------------------------

function generateLineId(): string {
  return crypto.randomUUID();
}

function skippedLineCount(issues: readonly ParseIssue[]): number {
  return new Set(issues.filter((issue) => issue.reason !== "ignored-timestamp").map((issue) => issue.line)).size;
}

// -- Exports ------------------------------------------------------------------

export { generateLineId, skippedLineCount };
export type { ParseIssue, ParseResult, ParserFn };
