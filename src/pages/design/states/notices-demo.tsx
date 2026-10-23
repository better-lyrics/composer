import { DesignSection } from "@/pages/design/design-section";
import { StateCell } from "@/pages/design/state-cell";
import { type StateChip, StateChips } from "@/pages/design/state-chips";
import { useDemoNoticeKinds } from "@/pages/design/states/demo-notice-kinds";
import { HeaderNotices } from "@/ui/notices/header-notices";
import { type NoticeKind, orderedKinds } from "@/ui/notices/notice-model";
import { cn } from "@/utils/cn";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type NoticesState = "hidden" | "dismissed" | "full" | "compact";
type NoticesWidth = "wide" | "narrow";

// -- Functions -----------------------------------------------------------------

function noticesState(kinds: readonly (NoticeKind | null)[], width: NoticesWidth): NoticesState {
  if (orderedKinds(kinds).length > 0) return width === "wide" ? "full" : "compact";
  return kinds.some((kind) => kind && kind.dismissedFingerprints.length > 0) ? "dismissed" : "hidden";
}

// -- Components ----------------------------------------------------------------

const NoticesDemo: React.FC = () => {
  const demo = useDemoNoticeKinds();
  const [width, setWidth] = useState<NoticesWidth>("wide");
  const [generation, setGeneration] = useState(0);

  const restart = (enter: () => void, nextWidth: NoticesWidth = width) => {
    enter();
    setWidth(nextWidth);
    setGeneration((previous) => previous + 1);
  };

  const states: readonly StateChip<NoticesState>[] = [
    { id: "hidden", label: "Hidden", enter: () => restart(demo.clear) },
    { id: "dismissed", label: "All dismissed", enter: () => restart(demo.dismissAll) },
    { id: "full", label: "Full", enter: () => restart(demo.reset, "wide") },
    { id: "compact", label: "Compact", enter: () => restart(demo.reset, "narrow") },
  ];

  return (
    <DesignSection
      id="notices"
      note="Suggestions sit in a pill in the header. When the full pill does not fit beside the other header controls, it folds to a count. Click it to open the list. Dismissing one leaves an Undo for 5 seconds, and dismissed suggestions come back from the bulb."
    >
      <StateChips label="Notice states" states={states} current={noticesState(demo.kinds, width)} />
      <StateCell label={width === "wide" ? "Wide header" : "Narrow header"}>
        <div className={cn("flex justify-end", width === "wide" ? "w-full max-w-xl" : "w-56")}>
          <HeaderNotices key={generation} kinds={demo.kinds} />
        </div>
      </StateCell>
    </DesignSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { NoticesDemo };
