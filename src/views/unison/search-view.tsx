import { IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { quotedTitle } from "@/domain/project/display-title";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { isOwnLyric } from "@/domain/unison/ownership";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { useUnisonSearch } from "@/hooks/unison/useUnisonSearch";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonSearchResult } from "@/lib/unison/api-types";
import { openUnisonLyric } from "@/lib/unison/open-unison-lyric";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconField } from "@/ui/icon-field";
import { cn } from "@/utils/cn";
import { focusOnMount } from "@/utils/focus-on-mount";
import { toast } from "@/utils/toast";
import { MINE_GRID } from "@/views/unison/mine-row";
import { SearchResults } from "@/views/unison/search-results";
import { InlineError, SkeletonBar, SkeletonRows, SkeletonSong, ViewEmpty } from "@/views/unison/view-states";

// -- Types ---------------------------------------------------------------------

interface SearchBodyProps {
  search: ReturnType<typeof useUnisonSearch>;
  ownKeyId: string | null;
  openingId: number | null;
  onOpen: (result: UnisonSearchResult) => void;
  onClear: () => void;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonSearch]";
const SKELETON_ROW_COUNT = 4;

// -- Components ----------------------------------------------------------------

const SearchSkeleton: React.FC = () => (
  <SkeletonRows count={SKELETON_ROW_COUNT} rowClassName={cn(MINE_GRID, "h-14")}>
    <SkeletonSong />
    <SkeletonBar className="w-24" />
    <SkeletonBar className="w-16" />
    <SkeletonBar className="w-20 justify-self-end" />
  </SkeletonRows>
);

const SearchBody: React.FC<SearchBodyProps> = ({ search, ownKeyId, openingId, onOpen, onClear }) => {
  if (!search.searchedQuery) {
    return (
      <div className="flex flex-col py-20">
        <EmptyState
          icon={IconSearch}
          message="Find lyrics to start from"
          hint="Search by song or artist. Open any result as a project to fix it or make your own version."
        />
      </div>
    );
  }
  if (search.isError) return <InlineError error={search.error} onRetry={() => void search.refetch()} />;
  if (!search.data) return <SearchSkeleton />;
  if (search.data.length === 0) {
    return (
      <ViewEmpty message={`No lyrics on Unison for ${quotedTitle(search.searchedQuery)}.`}>
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear search
        </Button>
      </ViewEmpty>
    );
  }
  return <SearchResults results={search.data} ownKeyId={ownKeyId} openingId={openingId} onOpen={onOpen} />;
};

const SearchView: React.FC = () => {
  const session = useUnisonSession();
  const ownKeyId = session?.keyId ?? null;
  const { entries } = useProjectIndex();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const search = useUnisonSearch(query);

  const open = (result: UnisonSearchResult) => {
    if (openingId !== null || !entries) return;
    setOpeningId(result.id);
    // One project carries the link, so a second copy of your own lyric opens unlinked.
    const link = isOwnLyric(result, ownKeyId) && !projectsByLyricId(entries).has(String(result.id));
    fetchUnisonLyric(queryClient, result.id)
      .then((lyric) => openUnisonLyric(lyric, { link, navigate }))
      .catch((error: unknown) => {
        console.error(LOG_PREFIX, "could not open the lyrics as a project", error);
        toast.error(error instanceof Error ? error.message : "Couldn't open those lyrics");
      })
      .finally(() => setOpeningId(null));
  };

  return (
    <section aria-label="Search Unison" className="flex flex-col gap-5">
      <IconField
        ref={focusOnMount}
        icon={IconSearch}
        aria-label="Search Unison"
        placeholder="Search every lyric on Unison"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        wrapperClassName="w-full"
        className="h-11 rounded-xl text-[15px]"
      />
      <SearchBody
        search={search}
        ownKeyId={ownKeyId}
        openingId={openingId}
        onOpen={open}
        onClear={() => setQuery("")}
      />
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { SearchView };
