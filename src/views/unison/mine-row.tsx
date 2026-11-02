import { unisonStatus } from "@/domain/unison/lyric-status";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { ConfidenceMeter } from "@/ui/unison/confidence-meter";
import { ScoreLabel } from "@/ui/unison/score-label";
import { unisonSyncLabel } from "@/ui/unison/sync-type-label";
import { DescribedUnisonStatusChip } from "@/ui/unison/unison-status-chip";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { cn } from "@/utils/cn";
import { IconFileImport } from "@tabler/icons-react";
import { memo } from "react";

// -- Types ---------------------------------------------------------------------

interface MineRowProps {
  item: UnisonMineItem;
  projectId: string | undefined;
  opening: boolean;
  onOpenProject: (projectId: string) => void;
  onOpenAsProject: (item: UnisonMineItem) => void;
}

// -- Constants -----------------------------------------------------------------

const MINE_GRID = "grid items-center gap-x-4 grid-cols-[40px_minmax(0,2fr)_132px_120px_120px_148px] px-3";
const ROW = "h-14 rounded-[10px] hover:bg-(--layer-1) transition-colors duration-100";

// -- Components ----------------------------------------------------------------

const MineColumns: React.FC = () => (
  <div
    aria-hidden="true"
    className={cn(MINE_GRID, "h-8 shadow-[inset_0_-1px_0_var(--divider)] text-xs font-medium text-(--muted)")}
  >
    <span className="col-span-2">Song</span>
    <span>Status</span>
    <span>Score</span>
    <span>Confidence</span>
    <span />
  </div>
);

const MineRowContent: React.FC<MineRowProps> = ({ item, projectId, opening, onOpenProject, onOpenAsProject }) => {
  const status = unisonStatus(item);
  return (
    <li className={cn(MINE_GRID, ROW)}>
      <UnisonSongArt videoId={item.videoId} size="row" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" title={item.song}>
          {item.song}
        </p>
        <p className="text-[13px] text-(--muted) truncate">
          {item.artist} ・ {unisonSyncLabel(item.syncType)}
        </p>
      </div>
      <DescribedUnisonStatusChip status={status} className="justify-self-start" />
      <ScoreLabel score={item.score} voteCount={item.voteCount} />
      <ConfidenceMeter confidence={item.confidence} />
      {projectId ? (
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Open project, ${item.song}`}
          onClick={() => onOpenProject(projectId)}
          className="justify-self-end"
        >
          Open project
        </Button>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          hasIcon
          disabled={opening}
          aria-label={`Open as project, ${item.song}`}
          onClick={() => onOpenAsProject(item)}
          className="justify-self-end"
        >
          <IconFileImport aria-hidden="true" className="size-4" />
          Open as project
        </Button>
      )}
    </li>
  );
};

const MineRow = memo(MineRowContent);

// -- Exports -------------------------------------------------------------------

export { MINE_GRID, MineColumns, MineRow };
