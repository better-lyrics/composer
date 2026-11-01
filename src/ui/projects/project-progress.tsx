import { hasLyrics, projectStage, syncedLinesLabel, syncedPercent } from "@/domain/project/progress";
import { ProgressBar } from "@/ui/progress-bar";
import { SyncedBadge } from "@/ui/projects/synced-badge";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface ProjectProgressProps {
  lineCount: number;
  syncedLineCount: number;
  isActive?: boolean;
}

// -- Component ----------------------------------------------------------------

const ProjectProgress: React.FC<ProjectProgressProps> = ({ lineCount, syncedLineCount, isActive = false }) => {
  const counts = { lineCount, syncedLineCount };
  if (!hasLyrics(counts)) {
    return (
      <span className={cn("text-[13px]", isActive ? "text-composer-text-secondary" : "text-composer-text-muted")}>
        No lyrics
      </span>
    );
  }
  if (projectStage(counts) === "synced") {
    return <SyncedBadge className="justify-self-end" />;
  }
  return <ProgressBar percent={syncedPercent(counts)} label={syncedLinesLabel(counts)} />;
};

// -- Exports ------------------------------------------------------------------

export { ProjectProgress };
