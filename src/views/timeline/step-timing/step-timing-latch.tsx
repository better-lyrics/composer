import { useSettingsStore } from "@/stores/settings";
import { PopBody, PopGroup, PopHead, PopRow } from "@/ui/pop-layout";
import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { SplitLatch } from "@/ui/split-latch";
import { Switch } from "@/ui/switch";
import { setStepTimingMode } from "@/views/timeline/step-timing/press-step-key";
import { followStepUndo } from "@/views/timeline/step-timing/step-undo";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconMicrophone, IconStepInto } from "@tabler/icons-react";
import { useEffect, useState } from "react";

// -- Constants ---------------------------------------------------------------

const BACKGROUND_LABEL = "Include background vocals";

// -- Components ----------------------------------------------------------------

const BackgroundRow: React.FC = () => {
  const included = useSettingsStore((s) => s.stepTimingBackground);
  return (
    <PopRow label={BACKGROUND_LABEL} icon={IconMicrophone} hint="After each line's lead words">
      <Switch
        checked={included}
        label={BACKGROUND_LABEL}
        onCheckedChange={(next) => useSettingsStore.getState().set("stepTimingBackground", next)}
      />
    </PopRow>
  );
};

const StepTimingLatch: React.FC = () => {
  const stepTiming = useTimelineStore((s) => s.stepTiming);
  const [open, setOpen] = useState(false);
  useEffect(followStepUndo, []);
  return (
    <SplitLatch
      menuLabel="Step timing options"
      open={open}
      onOpenChange={setOpen}
      latch={
        <ShortcutToggleButton
          active={stepTiming}
          label="Step timing"
          shortcut={stepTiming ? "timeline.stepTimingOff" : "timeline.stepWord"}
          onClick={() => setStepTimingMode(!stepTiming)}
          description="Timing keys follow the selected word and move on. Click an empty lane to time just that lane"
          iconOnly
        >
          <IconStepInto />
        </ShortcutToggleButton>
      }
    >
      <PopBody>
        <PopHead title="Step timing" />
        <PopGroup className="mt-1.5">
          <BackgroundRow />
        </PopGroup>
      </PopBody>
    </SplitLatch>
  );
};

// -- Exports -------------------------------------------------------------------

export { StepTimingLatch };
