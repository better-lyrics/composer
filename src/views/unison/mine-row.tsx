import { IconChevronDown, IconFileImport, IconFolderOpen } from "@tabler/icons-react";
import { memo } from "react";
import { unisonStatus } from "@/domain/unison/lyric-status";
import type { MineSort, MineSortKey } from "@/domain/unison/mine-sort";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { ConfidenceMeter } from "@/ui/unison/confidence-meter";
import { ScoreLabel } from "@/ui/unison/score-label";
import { unisonSyncLabel } from "@/ui/unison/sync-type-label";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { DescribedUnisonStatusChip } from "@/ui/unison/unison-status-chip";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format-relative-time";

// -- Types ---------------------------------------------------------------------

interface MineRowProps {
  item: UnisonMineItem;
  projectId: string | undefined;
  now: number;
  opening: boolean;
  waiting?: boolean;
  onOpenProject: (projectId: string) => void;
  onOpenAsProject: (item: UnisonMineItem) => void;
}

interface MineColumnsProps {
  sort: MineSort | null;
  onSort: (key: MineSortKey) => void;
}

// -- Constants -----------------------------------------------------------------

const MINE_GRID = "grid items-center gap-x-4 grid-cols-[40px_minmax(0,2fr)_150px_110px_150px] px-3";
const UNISON_ROW =
  "group/row h-14 rounded-[10px] hover:bg-(--layer-1) focus-within:bg-(--layer-1) transition-colors duration-100";
const ROW_AT_REST = "group-hover/row:opacity-0 group-focus-within/row:opacity-0 pointer-coarse:hidden";
const ROW_REVEAL =
  "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100";

const SORT_COLUMNS: readonly { key: MineSortKey; label: string; className?: string }[] = [
  { key: "song", label: "Song", className: "col-span-2" },
  { key: "score", label: "Score" },
  { key: "confidence", label: "Confidence" },
  { key: "updated", label: "Updated", className: "justify-self-end flex-row-reverse" },
];

// -- Components ----------------------------------------------------------------

const MineColumns: React.FC<MineColumnsProps> = ({ sort, onSort }) => (
  <div className={cn(MINE_GRID, "h-8 shadow-[inset_0_-1px_0_var(--divider)] text-xs font-medium text-(--muted)")}>
    {SORT_COLUMNS.map((column) => {
      const direction = sort?.key === column.key ? sort.direction : null;
      return (
        <button
          key={column.key}
          type="button"
          aria-label={`Sort by ${column.label.toLowerCase()}${direction ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
          aria-pressed={direction !== null}
          onClick={() => onSort(column.key)}
          className={cn(
            "flex items-center gap-1 justify-self-start -mx-1 px-1 h-6 rounded-md cursor-pointer select-none transition-colors duration-150 hover:text-composer-text focus-visible:outline-2 focus-visible:outline-composer-accent",
            direction && "text-composer-text",
            column.className,
          )}
        >
          {column.label}
          <IconChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 transition-[rotate,opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-opacity",
              direction === null && "opacity-0 scale-25 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none",
              direction === "asc" && "rotate-180",
            )}
          />
        </button>
      );
    })}
  </div>
);

const RowAction: React.FC<Omit<MineRowProps, "now">> = ({
  item,
  projectId,
  opening,
  waiting,
  onOpenProject,
  onOpenAsProject,
}) =>
  projectId ? (
    <Button
      size="sm"
      variant="secondary"
      aria-label={`Open project, ${item.song}`}
      onClick={() => onOpenProject(projectId)}
      className={ROW_REVEAL}
    >
      Open project
    </Button>
  ) : (
    <Button
      size="sm"
      variant="secondary"
      hasIcon
      disabled={opening || waiting}
      aria-label={`Open as project, ${item.song}`}
      onClick={() => onOpenAsProject(item)}
      className={ROW_REVEAL}
    >
      <IconFileImport aria-hidden="true" className="size-4" />
      Open as project
    </Button>
  );

const MineRowContent: React.FC<MineRowProps> = ({ now, ...props }) => {
  const { item, projectId } = props;
  const status = unisonStatus(item);
  return (
    <li className={cn(MINE_GRID, UNISON_ROW)}>
      <UnisonSongArt videoId={item.videoId} size="row" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate" title={item.song}>
            {item.song}
          </span>
          {status !== "live" && <DescribedUnisonStatusChip status={status} className="shrink-0" />}
        </p>
        <p className="text-[13px] text-(--muted) truncate">
          {item.artist} ・ {unisonSyncLabel(item.syncType)}
        </p>
      </div>
      <ScoreLabel score={item.score} voteCount={item.voteCount} />
      <ConfidenceMeter confidence={item.confidence} label="short" />
      <div className="grid justify-items-end items-center *:[grid-area:1/1]">
        <span
          className={cn("flex items-center gap-1.5 text-[13px] text-(--muted) tabular-nums select-text", ROW_AT_REST)}
        >
          {projectId && <IconFolderOpen role="img" aria-label="In your projects" className="size-4 shrink-0" />}
          {formatRelativeTime(item.revision.updatedAt * 1000, now)}
        </span>
        <RowAction {...props} />
      </div>
    </li>
  );
};

const MineRow = memo(MineRowContent);

// -- Exports -------------------------------------------------------------------

export { MINE_GRID, MineColumns, MineRow, ROW_AT_REST, ROW_REVEAL, UNISON_ROW };
