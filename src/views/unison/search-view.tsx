import { useUnisonSearch } from "@/hooks/unison/useUnisonSearch";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonSearchResult } from "@/lib/unison/api-types";
import { IconField } from "@/ui/icon-field";
import { quotedTitle } from "@/domain/project/display-title";
import { focusOnMount } from "@/utils/focus-on-mount";
import { Button } from "@/ui/button";
import { LyricPreview } from "@/views/unison/lyric-preview";
import { SearchResults } from "@/views/unison/search-results";
import { InlineError, SkeletonBar, SkeletonRows, ViewEmpty } from "@/views/unison/view-states";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

interface SearchBodyProps {
  search: ReturnType<typeof useUnisonSearch>;
  results: readonly UnisonSearchResult[] | undefined;
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onClear: () => void;
}

// -- Constants -----------------------------------------------------------------

const SKELETON_ROW_COUNT = 3;
const VERSION_ROW = "grid grid-cols-[minmax(0,1fr)_132px_100px_120px] items-center gap-4 h-12 px-3";

// -- Components ----------------------------------------------------------------

const SearchSkeleton: React.FC = () => (
  <SkeletonRows count={SKELETON_ROW_COUNT} rowClassName={VERSION_ROW}>
    <SkeletonBar className="w-2/5" />
    <SkeletonBar className="w-20" />
    <SkeletonBar className="w-10" />
    <SkeletonBar className="w-24 justify-self-end" />
  </SkeletonRows>
);

const SearchBody: React.FC<SearchBodyProps> = ({ search, results, selectedId, onSelect, onClear }) => {
  if (!search.searchedQuery) return null;
  if (search.isError) return <InlineError error={search.error} onRetry={() => void search.refetch()} />;
  if (!results) return <SearchSkeleton />;
  if (results.length === 0) {
    return (
      <ViewEmpty message={`No lyrics on Unison for ${quotedTitle(search.searchedQuery)}.`}>
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear search
        </Button>
      </ViewEmpty>
    );
  }
  return <SearchResults results={results} selectedId={selectedId} onSelect={onSelect} />;
};

const SearchView: React.FC = () => {
  const session = useUnisonSession();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const search = useUnisonSearch(query);
  const results = search.searchedQuery ? search.data : undefined;
  const selected = results?.find((result) => result.id === selectedId) ?? results?.[0];

  return (
    <section aria-label="Search Unison" className="grid grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <IconField
          ref={focusOnMount}
          icon={IconSearch}
          aria-label="Search Unison"
          placeholder="Song or artist"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 rounded-[10px] text-sm"
        />
        <SearchBody
          search={search}
          results={results}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          onClear={() => setQuery("")}
        />
      </div>
      {selected && <LyricPreview key={selected.id} result={selected} ownKeyId={session?.keyId ?? null} />}
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { SearchView };
