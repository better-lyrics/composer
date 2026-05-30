import type { LyricsSearchResult, ProviderName } from "@/domain/lyrics-search/result";
import { IconSearch } from "@tabler/icons-react";
import { ResultRow } from "@/views/lyrics-import-modal/result-row";
import type { LyricsSearchError } from "@/utils/lyrics-search/types";

// -- Types --------------------------------------------------------------------

interface SearchResultsProps {
  results: LyricsSearchResult[];
  errors: Map<ProviderName, LyricsSearchError>;
  isFetching: boolean;
  focusedIndex: number;
  hoveredIndex: number;
  selectingId: string | null;
  expectedDurationSec: number | undefined;
  onHover: (index: number) => void;
  onSelect: (result: LyricsSearchResult) => void;
  providerDisplayName: (name: string) => string;
}

// -- Constants ----------------------------------------------------------------

const SKELETON_ROW_COUNT = 3;

// -- Component ----------------------------------------------------------------

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  errors,
  isFetching,
  focusedIndex,
  hoveredIndex,
  selectingId,
  expectedDurationSec,
  onHover,
  onSelect,
  providerDisplayName,
}) => {
  if (errors.size > 0 && results.length === 0 && !isFetching) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-8 text-center" role="alert">
        <span className="text-xs text-composer-error-text">
          {[...errors.values()].map((err) => `${providerDisplayName(err.provider)}: ${err.message}`).join(" ・ ")}
        </span>
        <span className="text-[11px] text-composer-text-muted">Try adjusting your search.</span>
      </div>
    );
  }
  if (results.length > 0) {
    return (
      <div role="listbox" aria-label="Search results" className="flex flex-col gap-1.5">
        {results.map((result, index) => (
          <ResultRow
            key={result.id}
            result={result}
            isHovered={hoveredIndex === index}
            isFocused={focusedIndex === index}
            isSelecting={selectingId === result.id}
            expectedDurationSec={expectedDurationSec}
            onHover={() => onHover(index)}
            onSelect={() => onSelect(result)}
          />
        ))}
      </div>
    );
  }
  if (isFetching) {
    return (
      <div className="flex flex-col gap-1.5" aria-busy="true">
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count decorative skeleton
            key={i}
            data-testid="result-skeleton"
            className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse"
          >
            <span className="size-6 rounded-md bg-white/4" />
            <span className="h-3 rounded bg-white/4 w-3/4" />
            <span className="h-3 rounded bg-white/4 w-12" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="m-auto flex flex-col items-center px-4 text-center">
      <IconSearch size={22} className="text-composer-text opacity-25 mb-2" aria-hidden="true" />
      <span className="text-xs font-medium text-composer-text-secondary">Type a track or paste a video ID</span>
      <span className="text-[11px] text-composer-text-muted mt-0.5">
        Artist narrows results. Album, duration, video ID are optional but help.
      </span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SearchResults };
export type { SearchResultsProps };
