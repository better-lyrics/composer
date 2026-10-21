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
      <span className="hidden shrink-0 items-center gap-1 text-xs text-composer-text-muted select-none sm:flex">
        <IconCheck className="size-3.5 text-composer-positive" />
        <span className="tabular-nums">{length}</span> matches audio
      </span>
    );
  }
  if (!delta) return null;
  return (
    <span className="hidden shrink-0 items-center gap-1 text-xs text-composer-text-muted select-none sm:flex">
      <IconAlertTriangle className="size-3.5 text-composer-warning" />
      <span className="tabular-nums">{delta}</span>
    </span>
  );
};

const MatchStrip: React.FC<MatchStripProps> = ({ matches, chosen, details, onChoose }) => {
  const subtitle = [details.artists.join(", "), details.album, details.releaseYear].filter(Boolean).join(" ・ ");
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-composer-border bg-composer-input p-2 pr-2.5">
      <CoverArt
        key={details.coverReleaseGroupId}
        releaseGroupId={details.coverReleaseGroupId}
        className="size-11 rounded-md"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium select-text cursor-text">{details.title}</span>
        {subtitle && (
          <span className="truncate text-xs text-composer-text-muted select-text cursor-text">{subtitle}</span>
        )}
      </div>
      <LengthStatus match={chosen} />
      <Popover
        hasPopup="listbox"
        placement="bottom-end"
        aria-label="Change match"
        trigger={
          <Button hasIcon variant="ghost" size="sm">
            <IconSwitchHorizontal className="size-3.5" />
            Change
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
