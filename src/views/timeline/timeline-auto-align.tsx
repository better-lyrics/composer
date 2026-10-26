import { Tooltip } from "@/ui/tooltip";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { AutoAlignDropdown } from "@/views/sync/auto-align-dropdown";
import { useEffect, useState } from "react";

// -- Constants -----------------------------------------------------------------

const AUTO_ALIGN_EVENT = "timeline:auto-align";

// -- Component -----------------------------------------------------------------

// The Sync tab's auto-align popover, in its own tray. The shortcut opens it
// rather than starting a run, so the download prompt and Re-align stay a choice.
const TimelineAutoAlign: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((was) => !was);
    window.addEventListener(AUTO_ALIGN_EVENT, toggle);
    return () => window.removeEventListener(AUTO_ALIGN_EVENT, toggle);
  }, []);

  return (
    <Tooltip
      content={<ShortcutTip label="Auto-align words" shortcut="timeline.autoAlign" />}
      placement="bottom"
      disabled={open}
    >
      <div className="tray empty:hidden">
        <AutoAlignDropdown open={open} onOpenChange={setOpen} size="sm" />
      </div>
    </Tooltip>
  );
};

// -- Exports -------------------------------------------------------------------

export { AUTO_ALIGN_EVENT, TimelineAutoAlign };
