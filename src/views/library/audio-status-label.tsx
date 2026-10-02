import { type AudioStatusFields, projectAudioStatus } from "@/domain/project/audio-status";
import { cn } from "@/utils/cn";
import { formatFileSize } from "@/utils/format-file-size";
import { IconAlertTriangle, IconBrandYoutube, IconFileMusic } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface AudioStatusLabelProps {
  project: AudioStatusFields;
  compact?: boolean;
}

// -- Constants ----------------------------------------------------------------

const LABEL_STYLES = "inline-flex items-center gap-1.5 min-w-0 whitespace-nowrap";

// -- Component ----------------------------------------------------------------

const AudioStatusLabel: React.FC<AudioStatusLabelProps> = ({ project, compact = false }) => {
  const status = projectAudioStatus(project);
  const textSize = compact ? "text-xs" : "text-[13px]";

  if (status.kind === "none") {
    return <span className={cn(textSize, "text-composer-text-muted")}>No audio</span>;
  }
  if (status.kind === "missing") {
    return (
      <span className={cn(LABEL_STYLES, textSize, "text-composer-warning")}>
        <IconAlertTriangle aria-hidden="true" className="size-4 shrink-0" />
        Audio missing
      </span>
    );
  }
  const StatusIcon = status.kind === "youtube" ? IconBrandYoutube : IconFileMusic;
  return (
    <span className={cn(LABEL_STYLES, textSize, "text-composer-text-secondary")}>
      <StatusIcon aria-hidden="true" className="size-4 shrink-0 text-composer-text opacity-50" />
      {status.kind === "youtube" ? "YouTube" : status.format}
      {status.kind === "file" && !compact && (
        <span className="tabular-nums text-composer-text-muted">{formatFileSize(status.bytes)}</span>
      )}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { AudioStatusLabel };
