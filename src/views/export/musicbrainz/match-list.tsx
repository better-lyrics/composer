import type { RankedMatch } from "@/domain/musicbrainz/rank-matches";
import { pickDisplayRelease } from "@/domain/musicbrainz/song-details";
import { Button } from "@/ui/button";
import { LinkButton } from "@/ui/link-button";
import { cn } from "@/utils/cn";
import { CoverArt } from "@/views/export/musicbrainz/cover-art";
import { lengthDeltaLabel, recordingLength } from "@/views/export/musicbrainz/length-delta";
import { recordingSearchPageUrl } from "@/views/export/musicbrainz/musicbrainz-links";
import { IconExternalLink } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface MatchListProps {
  matches: RankedMatch[];
  chosenId: string;
  title: string;
  onChoose: (recordingId: string) => void;
  close: () => void;
}

interface MatchRowProps {
  match: RankedMatch;
  chosen: boolean;
  onSelect: () => void;
}

// -- Constants ----------------------------------------------------------------

const MAX_MATCHES = 8;

// -- Components ---------------------------------------------------------------

const DeltaChip: React.FC<{ match: RankedMatch }> = ({ match }) => {
  const label = match.matchesAudio ? recordingLength(match) : (lengthDeltaLabel(match) ?? recordingLength(match));
  if (!label) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-px font-mono text-[11px] tabular-nums bg-composer-input",
        match.matchesAudio && "text-composer-positive",
        !match.matchesAudio && match.lengthDeltaSec !== null && "text-composer-warning",
      )}
    >
      {label}
    </span>
  );
};

const MatchRow: React.FC<MatchRowProps> = ({ match, chosen, onSelect }) => {
  const release = pickDisplayRelease(match.recording.releases ?? []);
  const releaseGroup = release?.["release-group"];
  const coverId = releaseGroup?.id ?? null;
  const subtitle =
    match.recording.disambiguation || releaseGroup?.["secondary-types"]?.[0] || releaseGroup?.["primary-type"];
  return (
    <Button
      aria-pressed={chosen}
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "h-auto w-full justify-start gap-3 rounded-md px-2.5 py-2 text-left font-normal text-composer-text",
        chosen && "bg-(--layer-2)",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded bg-composer-input">
        <CoverArt releaseGroupId={coverId} className="size-8" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-sm", !release && "text-composer-text-secondary")}>
          {release?.title ?? "No release"}
        </span>
        {subtitle && <span className="truncate text-xs text-composer-text-muted">{subtitle}</span>}
      </span>
      <DeltaChip match={match} />
    </Button>
  );
};

const MatchList: React.FC<MatchListProps> = ({ matches, chosenId, title, onChoose, close }) => {
  const artist = matches[0]?.recording["artist-credit"]?.[0]?.name;
  const heading = artist ? `Recordings of ${title} by ${artist}` : `Recordings of ${title}`;
  return (
    <div className="flex w-100 flex-col p-1">
      <p className="px-2.5 pt-1.5 pb-1 text-xs text-composer-text-muted wrap-break-word select-none">{heading}</p>
      <div role="group" aria-label={heading} className="flex flex-col">
        {matches.slice(0, MAX_MATCHES).map((match) => (
          <MatchRow
            key={match.recording.id}
            match={match}
            chosen={match.recording.id === chosenId}
            onSelect={() => {
              onChoose(match.recording.id);
              close();
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex border-t border-(--divider) px-1 pt-1">
        <LinkButton href={recordingSearchPageUrl(title)} external variant="ghost" size="sm" className="gap-1">
          Search on musicbrainz.org
          <IconExternalLink className="size-3.5" />
        </LinkButton>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MatchList };
