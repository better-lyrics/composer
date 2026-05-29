import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { cn } from "@/utils/cn";
import { formatDuration } from "@/views/lyrics-import-modal/duration-input-utils";
import { SyncTypeBadge } from "@/views/lyrics-import-modal/sync-type-badge";
import { IconLoader2, IconMusic } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const MATCH_TOLERANCE_SEC = 2;

// -- Types --------------------------------------------------------------------

interface ResultRowProps {
  result: LyricsSearchResult;
  isHovered: boolean;
  isFocused: boolean;
  isSelecting: boolean;
  expectedDurationSec?: number;
  onHover: () => void;
  onSelect: () => void;
}

// -- Helpers ------------------------------------------------------------------

function durationMatches(actual: number, expected: number | undefined): boolean {
  if (expected === undefined || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= MATCH_TOLERANCE_SEC;
}

function joinArtistAlbum(artist: string, album: string | undefined): string {
  if (album && album.trim().length > 0) return `${artist} ・ ${album}`;
  return artist;
}

// -- Component ----------------------------------------------------------------

const ResultRow: React.FC<ResultRowProps> = ({
  result,
  isHovered,
  isFocused,
  isSelecting,
  expectedDurationSec,
  onHover,
  onSelect,
}) => {
  const isActive = isHovered || isFocused;
  const showMatchDot = durationMatches(result.durationSec, expectedDurationSec);

  const handleClick = () => {
    if (isSelecting) return;
    onSelect();
  };

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={handleClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      aria-busy={isSelecting}
      className={cn(
        "grid grid-cols-[24px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left cursor-pointer transition-colors",
        isActive && "bg-composer-button/30",
        isSelecting && "opacity-60 cursor-progress",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center size-6 rounded-md bg-white/4 text-composer-text-muted",
          isActive && "bg-composer-accent/18 text-composer-accent-text",
        )}
        aria-hidden="true"
      >
        <IconMusic size={13} stroke={1.75} />
      </span>

      <span className="min-w-0 flex flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-composer-text select-text">{result.track}</span>
        <span className="truncate text-xs text-composer-text-muted select-text">
          {joinArtistAlbum(result.artist, result.album)}
        </span>
      </span>

      <span className="flex items-center gap-2 shrink-0">
        <span className="tabular-nums font-mono text-[11px] text-composer-text-secondary select-text">
          {showMatchDot ? (
            <span
              aria-label="Matches your duration"
              className="inline-block size-1.5 rounded-full bg-composer-accent shadow-[0_0_0_3px_rgba(129,140,248,0.18)] mr-1.5 align-middle"
            />
          ) : null}
          {formatDuration(result.durationSec)}
        </span>
        <SyncTypeBadge syncType={result.syncType} />
        <span className="text-[10px] font-medium text-composer-text-muted tracking-wide">{result.sourceLabel}</span>
        {isSelecting ? (
          <IconLoader2 size={12} className="animate-spin text-composer-accent-text" aria-label="Loading" />
        ) : null}
      </span>
    </button>
  );
};

// -- Exports ------------------------------------------------------------------

export { ResultRow };
export type { ResultRowProps };
