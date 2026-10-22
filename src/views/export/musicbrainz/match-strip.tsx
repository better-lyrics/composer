import type { RankedMatch } from "@/domain/musicbrainz/rank-matches";
import type { SongDetails } from "@/domain/musicbrainz/song-details";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { CoverArt } from "@/views/export/musicbrainz/cover-art";
import { lengthDeltaLabel, recordingLength } from "@/views/export/musicbrainz/length-delta";
import { MatchList } from "@/views/export/musicbrainz/match-list";
import { IconAlertTriangle, IconCheck, IconSwitchHorizontal } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface MatchStripProps {
  matches: RankedMatch[];
  chosen: RankedMatch;
  details: SongDetails;
  onChoose: (recordingId: string) => void;
}

// -- Components ---------------------------------------------------------------

const LengthStatus: React.FC<{ match: RankedMatch }> = ({ match }) => {
  const length = recordingLength(match);
  const delta = lengthDeltaLabel(match);
  if (match.matchesAudio && length) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-(--muted) select-none">
        <IconCheck className="size-3.5 text-composer-positive" />
        <span className="tabular-nums">{length}</span>
        <span className="sr-only">matches audio</span>
      </span>
    );
  }
  if (!delta) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-(--muted) select-none">
      <IconAlertTriangle className="size-3.5 text-composer-warning" />
      <span className="tabular-nums">{delta}</span>
    </span>
  );
};

const MatchStrip: React.FC<MatchStripProps> = ({ matches, chosen, details, onChoose }) => {
  const subtitle = [details.artists.join(", "), details.releaseTitle, details.releaseYear].filter(Boolean).join(" ・ ");
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--divider)] p-2">
      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-(--layer-2)">
        <CoverArt
          key={details.coverReleaseGroupId}
          releaseGroupId={details.coverReleaseGroupId}
          className="size-10 rounded-lg"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-semibold select-text cursor-text">{details.title}</span>
        {subtitle && <span className="truncate text-xs text-(--muted) select-text cursor-text">{subtitle}</span>}
      </div>
      <LengthStatus match={chosen} />
      <Popover
        hasPopup="dialog"
        placement="bottom-end"
        aria-label="Change match"
        trigger={
          <Button
            hasIcon
            variant="ghost"
            size="sm"
            aria-label="Change match"
            title="Change match"
            className="pl-2.5 pr-3"
          >
            <IconSwitchHorizontal className="size-4" />
          </Button>
        }
      >
        {(close) => (
          <MatchList
            matches={matches}
            chosenId={chosen.recording.id}
            title={details.title}
            onChoose={onChoose}
            close={close}
          />
        )}
      </Popover>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MatchStrip };
