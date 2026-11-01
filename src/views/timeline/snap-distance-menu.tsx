import { useSettingsStore } from "@/stores/settings";
import { settingEntry } from "@/stores/settings-catalog";
import { SNAP_DISTANCE_RANGE_PX, SNAP_DISTANCE_SETTING, type SnapSource } from "@/stores/settings-snap";
import { PopBody, PopFieldLabel, PopHead, PopText } from "@/ui/pop-layout";
import { Slider } from "@/ui/slider";
import { SNAP_SOURCE_DISPLAY, SNAP_SOURCES } from "@/views/timeline/snap-source-display";
import { useId } from "react";

// -- Components ----------------------------------------------------------------

const SnapDistanceField: React.FC<{ source: SnapSource }> = ({ source }) => {
  const id = useId();
  const key = SNAP_DISTANCE_SETTING[source];
  const distance = useSettingsStore((s) => s[key]);
  const { label } = SNAP_SOURCE_DISPLAY[source];
  return (
    <section className="grid gap-2">
      <PopFieldLabel id={id} value={`${distance} px`}>
        {label}
      </PopFieldLabel>
      <Slider
        aria-label={settingEntry(key).label}
        value={distance}
        min={SNAP_DISTANCE_RANGE_PX.min}
        max={SNAP_DISTANCE_RANGE_PX.max}
        step={1}
        onChange={(next) => useSettingsStore.getState().set(key, next)}
      />
    </section>
  );
};

const SnapDistanceMenu: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PopBody>
    <PopHead title="Snap distance" onBack={onBack} />
    <PopText className="mt-1">How close an edge has to get to each one before it locks on.</PopText>
    <div className="grid gap-4 px-2.5 pt-3 pb-2">
      {SNAP_SOURCES.map((source) => (
        <SnapDistanceField key={source} source={source} />
      ))}
    </div>
  </PopBody>
);

// -- Exports -------------------------------------------------------------------

export { SnapDistanceMenu };
