import { useSettingsStore } from "@/stores/settings";
import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { SplitLatch } from "@/ui/split-latch";
import { cn } from "@/utils/cn";
import { MOD_KEY } from "@/utils/platform";
import { PopBody } from "@/ui/pop-layout";
import { BeatGridPopoverBody } from "@/views/timeline/beat-grid/beat-grid-popover";
import { SnapMenu } from "@/views/timeline/snap-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconMagnet } from "@tabler/icons-react";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type SnapMenuView = "sources" | "beat-grid";

// -- Components ----------------------------------------------------------------

const SnapLatch: React.FC = () => {
  const enabled = useSettingsStore((s) => s.timelineSnap);
  const isBypassing = useTimelineStore((s) => s.isBypassing);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SnapMenuView>("sources");

  const backOnEscape = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    setView("sources");
  };

  const handleOpenChange = (next: boolean) => {
    if (next) setView("sources");
    setOpen(next);
  };

  return (
    <SplitLatch
      menuLabel="Snap sources"
      open={open}
      onOpenChange={handleOpenChange}
      latch={
        <ShortcutToggleButton
          active={enabled}
          label="Snap"
          shortcut="timeline.toggleSnap"
          onClick={() => useSettingsStore.getState().toggle("timelineSnap")}
          className={cn(isBypassing && "opacity-50")}
          description={`Hold ${MOD_KEY} to bypass`}
          iconOnly
        >
          <IconMagnet />
        </ShortcutToggleButton>
      }
    >
      {view === "sources" ? (
        <PopBody>
          <SnapMenu onOpenBeatGrid={() => setView("beat-grid")} />
        </PopBody>
      ) : (
        <div onKeyDown={backOnEscape}>
          <BeatGridPopoverBody onBack={() => setView("sources")} />
        </div>
      )}
    </SplitLatch>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapLatch };
