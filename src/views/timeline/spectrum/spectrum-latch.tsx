import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { SplitLatch } from "@/ui/split-latch";
import { SpectrumPopoverBody } from "@/views/timeline/spectrum/spectrum-popover";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconGrain } from "@tabler/icons-react";
import { useState } from "react";

// -- Component -----------------------------------------------------------------

const SpectrumLatch: React.FC = () => {
  const visible = useTimelineStore((s) => s.spectrumVisible);
  const toggleSpectrum = useTimelineStore((s) => s.toggleSpectrum);
  const [open, setOpen] = useState(false);
  return (
    <SplitLatch
      menuLabel="Spectrum settings"
      open={open}
      onOpenChange={setOpen}
      latch={
        <ShortcutToggleButton
          active={visible}
          label="Spectrum"
          shortcut="timeline.toggleSpectrum"
          onClick={toggleSpectrum}
          iconOnly
        >
          <IconGrain />
        </ShortcutToggleButton>
      }
    >
      <SpectrumPopoverBody />
    </SplitLatch>
  );
};

// -- Exports -------------------------------------------------------------------

export { SpectrumLatch };
