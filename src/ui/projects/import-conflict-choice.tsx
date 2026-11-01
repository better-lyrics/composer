import { displayArtists, displayTitle } from "@/domain/project/display-title";
import { type ProgressCounts, hasLyrics, syncedLinesLabel } from "@/domain/project/progress";
import { FINISH_IMPORT_FIRST } from "@/lib/import-busy-message";
import type { ImportConflict, ProjectFileSummary } from "@/lib/project-import";
import { askChoice } from "@/stores/choice-store";
import { ProjectArt } from "@/ui/projects/project-art";
import { formatRelativeTimeInline, formatShortDate } from "@/utils/format-relative-time";

// -- Types --------------------------------------------------------------------

type ImportConflictChoice = "replace" | "keep-both" | "cancel";

interface ImportConflictSummaryProps {
  existing: ImportConflict["existing"];
  fileSummary: ProjectFileSummary;
  askedAt: number;
}

// -- Helpers ------------------------------------------------------------------

function syncedCounts(counts: ProgressCounts): string {
  return hasLyrics(counts) ? syncedLinesLabel(counts) : "no lyrics";
}

// -- Component ----------------------------------------------------------------

const ImportConflictSummary: React.FC<ImportConflictSummaryProps> = ({ existing, fileSummary, askedAt }) => (
  <div className="grid grid-cols-[48px_1fr] items-center gap-3 p-3 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)]">
    <ProjectArt src={existing.thumbnailDataUrl} size="dialog" />
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="min-w-0">
        <div className="truncate font-medium select-text">{displayTitle(existing.title)}</div>
        <div className="truncate text-[13px] text-(--muted) select-text">{displayArtists(existing.artists)}</div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0 text-[13px] tabular-nums">
        <dt className="text-(--muted) select-none">In the file</dt>
        <dd className="m-0 select-text">
          Saved {formatShortDate(fileSummary.savedAt, askedAt)}, {syncedCounts(fileSummary)}
        </dd>
        <dt className="text-(--muted) select-none">In your library</dt>
        <dd className="m-0 select-text">
          Edited {formatRelativeTimeInline(existing.updatedAt, askedAt)}, {syncedCounts(existing)}
        </dd>
      </dl>
    </div>
  </div>
);

// -- Prompt -------------------------------------------------------------------

function askImportConflict(conflict: ImportConflict, fileSummary: ProjectFileSummary): Promise<ImportConflictChoice> {
  return askChoice({
    title: "Project already in your library",
    busyMessage: FINISH_IMPORT_FIRST,
    body: <ImportConflictSummary existing={conflict.existing} fileSummary={fileSummary} askedAt={Date.now()} />,
    options: [
      { value: "keep-both", label: "Keep both", variant: "secondary" },
      { value: "replace", label: "Replace project", variant: "destructive" },
    ],
  });
}

// -- Exports ------------------------------------------------------------------

export { askImportConflict };
