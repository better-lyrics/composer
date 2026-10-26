import { useSettingsStore } from "@/stores/settings";
import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { SplitLatch } from "@/ui/split-latch";
import { SpectrumPopoverBody } from "@/views/timeline/spectrum/spectrum-popover";
import { IconGrain } from "@tabler/icons-react";
import { useState } from "react";

// -- Component -----------------------------------------------------------------

const SpectrumLatch: React.FC = () => {
  const visible = useSettingsStore((s) => s.showSpectrum);
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
          onClick={() => useSettingsStore.getState().set("showSpectrum", !visible)}
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
