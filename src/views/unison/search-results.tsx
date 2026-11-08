import { IconFileImport } from "@tabler/icons-react";
import { isOwnLyric } from "@/domain/unison/ownership";
import type { UnisonSearchResult } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { ConfidenceMeter } from "@/ui/unison/confidence-meter";
import { ScoreLabel } from "@/ui/unison/score-label";
import { unisonSyncLabel } from "@/ui/unison/sync-type-label";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { MINE_GRID, ROW_AT_REST, ROW_REVEAL, UNISON_ROW } from "@/views/unison/mine-row";

// -- Types ---------------------------------------------------------------------

interface SearchResultsProps {
  results: readonly UnisonSearchResult[];
  ownKeyId: string | null;
  openingId: number | null;
  onOpen: (result: UnisonSearchResult) => void;
}

interface SearchRowProps {
  result: UnisonSearchResult;
  own: boolean;
  opening: boolean;
  onOpen: (result: UnisonSearchResult) => void;
}

// -- Components ----------------------------------------------------------------

const SearchRow: React.FC<SearchRowProps> = ({ result, own, opening, onOpen }) => (
  <li className={cn(MINE_GRID, UNISON_ROW)}>
    <UnisonSongArt videoId={result.videoId} size="row" />
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="truncate" title={result.song}>
          {result.song}
        </span>
        {own && (
          <span className="shrink-0 h-5 px-1.5 grid place-items-center rounded-md bg-(--layer-2) text-[11.5px] font-medium text-(--label)">
            Yours
          </span>
        )}
      </p>
      <p className="text-[13px] text-(--muted) truncate">
        {result.artist}
        {result.submitter && ` ・ by ${result.submitter.displayName}`}
      </p>
    </div>
    <ScoreLabel score={result.score} voteCount={result.voteCount} />
    <ConfidenceMeter confidence={result.confidence} label="short" />
    <div className="grid justify-items-end items-center *:[grid-area:1/1]">
      <span className={cn("text-[13px] text-(--muted) whitespace-nowrap", ROW_AT_REST)}>
        {unisonSyncLabel(result.syncType)}
      </span>
      <Button
        size="sm"
        variant="secondary"
        hasIcon
        disabled={opening}
        aria-label={`Open as project, ${result.song}`}
        onClick={() => onOpen(result)}
        className={ROW_REVEAL}
      >
        <IconFileImport aria-hidden="true" className="size-4" />
        Open as project
      </Button>
    </div>
  </li>
);

const SearchResults: React.FC<SearchResultsProps> = ({ results, ownKeyId, openingId, onOpen }) => (
  <div>
    <p className="px-3 pb-2 text-[13px] text-(--muted) tabular-nums">{pluralize(results.length, "result")}</p>
    <ul>
      {results.map((result) => (
        <SearchRow
          key={result.id}
          result={result}
          own={isOwnLyric(result, ownKeyId)}
          opening={openingId === result.id}
          onOpen={onOpen}
        />
      ))}
    </ul>
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SearchResults };
