import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { IconButton } from "@/ui/icon-button";
import { Popover } from "@/ui/popover";
import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { cn } from "@/utils/cn";
import { MOD_KEY } from "@/utils/platform";
import { PopBody } from "@/views/timeline/beat-grid/beat-grid-layout";
import { BeatGridPopoverBody } from "@/views/timeline/beat-grid/beat-grid-popover";
import { SnapMenu } from "@/views/timeline/snap-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconChevronDown, IconMagnet } from "@tabler/icons-react";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type SnapMenuView = "sources" | "beat-grid";

// -- Components ----------------------------------------------------------------

const SnapLatch: React.FC = () => {
  const enabled = useSettingsStore((s) => s.timelineSnap);
  const isBypassing = useTimelineStore((s) => s.isBypassing);
  const toggleKeys = getEffectiveKeysArray("timeline.toggleSnap");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SnapMenuView>("sources");
  const [pill, setPill] = useState<HTMLDivElement | null>(null);

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
    <div ref={setPill} className="snap-split">
      <ShortcutToggleButton
        active={enabled}
        label="Snap"
        shortcut="timeline.toggleSnap"
        onClick={() => useSettingsStore.getState().set("timelineSnap", !enabled)}
        className={cn(isBypassing && "opacity-50")}
        title={`Snap${toggleKeys.length ? ` (${toggleKeys.join(" ")})` : ""} · hold ${MOD_KEY} to bypass`}
      >
        <IconMagnet />
      </ShortcutToggleButton>
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottom-start"
        aria-label="Snap sources"
        positionAnchor={pill?.parentElement}
        trigger={
          <IconButton
            variant="ghost"
            label="Snap sources"
            icon={<IconChevronDown aria-hidden="true" className="size-[13px]" />}
          />
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
      </Popover>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SnapLatch };
