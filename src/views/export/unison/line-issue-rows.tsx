import { useMemo, useState } from "react";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import type { LineIssue } from "@/domain/unison/submit-checks";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { revealLineInTimeline } from "@/views/timeline/line-reveal-request";

// -- Interfaces ----------------------------------------------------------------

interface LyricSegment {
  offset: number;
  text: string;
  marked: boolean;
}

// -- Constants -----------------------------------------------------------------

const SHOWN_AT_FIRST = 3;

// -- Copy ----------------------------------------------------------------------

function issueProblem(issue: LineIssue): string {
  switch (issue.kind) {
    case "untimed":
      return "No timing";
    case "partial":
      return `${issue.timedSlots} of ${pluralize(issue.slotCount, "word")} timed`;
    case "background-only":
      return "No main lyrics";
    case "zero-length":
      return `${pluralize(issue.count, "word")} with no length`;
  }
}

function issueLabel(issue: LineIssue): string {
  const track = issue.track === "background" ? ["Background"] : [];
  return [`Line ${issue.lineIndex + 1}`, ...track, issueProblem(issue)].join(" ・ ");
}

// -- Lyric ---------------------------------------------------------------------

function issueText(line: LyricLine | undefined, issue: LineIssue): string {
  if (!line) return "";
  return issue.track === "main" ? lineText(line) : (backgroundText(line) ?? "");
}

// Neighbouring problem words share one mark, so the underline runs across the space between them.
function lyricSegments(text: string, problemSlots: readonly number[]): LyricSegment[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  const problems = new Set(problemSlots);
  const segments: LyricSegment[] = [];
  let offset = 0;
  const push = (piece: string, marked: boolean) => {
    const last = segments.at(-1);
    if (last?.marked === marked) last.text += piece;
    else segments.push({ offset, text: piece, marked });
    offset += piece.length;
  };
  parts.forEach((part, slot) => {
    const marked = problems.has(slot);
    push(part, marked);
    if (trailingSpace[slot]) push(" ", marked && problems.has(slot + 1));
  });
  return segments;
}

// -- Components ----------------------------------------------------------------

const IssueLyric: React.FC<{ text: string; problemSlots: readonly number[] }> = ({ text, problemSlots }) => (
  <span className="pb-0.5 text-[13px] leading-[18px] text-(--label) text-pretty select-text">
    {lyricSegments(text, problemSlots).map((segment) =>
      segment.marked ? (
        <mark key={segment.offset} className="problem-words">
          {segment.text}
        </mark>
      ) : (
        <span key={segment.offset}>{segment.text}</span>
      ),
    )}
  </span>
);

const LineIssueRow: React.FC<{ issue: LineIssue; text: string }> = ({ issue, text }) => (
  <button
    type="button"
    onClick={() => revealLineInTimeline(issue.lineId, issue.track === "main" ? "word" : "bg")}
    className="-mx-2 flex flex-col gap-px rounded-md px-2 py-1.5 text-left cursor-pointer transition-[background-color] duration-150 hover:bg-(--layer-2) motion-reduce:transition-none"
  >
    <span className="text-xs leading-[18px] text-(--muted) tabular-nums">{issueLabel(issue)}</span>
    <IssueLyric text={text} problemSlots={issue.problemSlots} />
  </button>
);

const LineIssueRows: React.FC<{ issues: readonly LineIssue[] }> = ({ issues }) => {
  const [expanded, setExpanded] = useState(false);
  const lines = useProjectStore((state) => state.lines);
  const linesById = useMemo(() => new Map(lines.map((line) => [line.id, line])), [lines]);
  const shown = expanded ? issues : issues.slice(0, SHOWN_AT_FIRST);
  const hiddenCount = issues.length - shown.length;
  return (
    <div className="mt-0.5 flex flex-col gap-0.5">
      {shown.map((issue) => (
        <LineIssueRow
          key={`${issue.lineId}-${issue.track}-${issue.kind}`}
          issue={issue}
          text={issueText(linesById.get(issue.lineId), issue)}
        />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-fit py-1 text-xs text-(--muted) cursor-pointer transition-[color] duration-150 hover:text-(--label) motion-reduce:transition-none"
        >
          Show {hiddenCount} more
        </button>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { LineIssueRows };
