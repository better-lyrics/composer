import { SegmentedControl } from "@/ui/segmented-control";
import { UNISON_VIEW_PARAM, type UnisonView } from "@/utils/app-routes";
import { MineView } from "@/views/unison/mine-view";
import { SearchView } from "@/views/unison/search-view";
import { WantedView } from "@/views/unison/wanted-view";
import { Activity, useState } from "react";
import { useSearchParams } from "react-router-dom";

// -- Constants -----------------------------------------------------------------

const DEFAULT_VIEW: UnisonView = "mine";
const VIEW_OPTIONS = [
  { value: "mine", label: "My lyrics" },
  { value: "wanted", label: "Most wanted" },
  { value: "search", label: "Search" },
] as const satisfies readonly { value: UnisonView; label: string }[];

// -- Helpers -------------------------------------------------------------------

function isUnisonView(value: string | null): value is UnisonView {
  return VIEW_OPTIONS.some((option) => option.value === value);
}

// -- Component -----------------------------------------------------------------

const UnisonScreen: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(UNISON_VIEW_PARAM);
  const view = isUnisonView(requested) ? requested : DEFAULT_VIEW;
  const [searchVisited, setSearchVisited] = useState(view === "search");
  if (view === "search" && !searchVisited) setSearchVisited(true);

  const showView = (next: UnisonView) => setSearchParams({ [UNISON_VIEW_PARAM]: next }, { replace: true });

  return (
    <div className="flex flex-col flex-1 min-h-0 mb-2 workspace-card">
      <main className="flex flex-1 min-h-0 overflow-y-auto overscroll-none">
        <div className="flex flex-col gap-6 flex-1 min-w-0 max-w-[1264px] mx-auto px-16 pt-8 pb-10 select-none max-[720px]:px-5">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-[-0.01em]">Unison</h1>
            <SegmentedControl aria-label="Unison view" value={view} options={VIEW_OPTIONS} onChange={showView} />
          </div>
          {view === "mine" && <MineView />}
          {view === "wanted" && <WantedView />}
          {searchVisited && (
            <Activity mode={view === "search" ? "visible" : "hidden"}>
              <SearchView />
            </Activity>
          )}
        </div>
      </main>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { UnisonScreen };
