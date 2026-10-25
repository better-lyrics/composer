import { useSettingsStore } from "@/stores/settings";
import { settingEntry } from "@/stores/settings-catalog";
import { Switch } from "@/ui/switch";
import { setPitchLineShown } from "@/views/timeline/pitch/pitch-line-toggle";
import { IconChartLine } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const PitchLineSwitch: React.FC = () => {
  const shown = useSettingsStore((s) => s.pitchLine !== "off");
  const label = settingEntry("pitchLine").label;

  return (
    <div className="flex items-center gap-2.5 select-none">
      <IconChartLine className="size-4 shrink-0 text-(--muted)" />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-medium text-composer-text">{label}</span>
        <span className="text-[12.5px] leading-[1.45] text-(--muted) truncate">Sung pitch inside word blocks</span>
      </div>
      <Switch checked={shown} label={label} onCheckedChange={setPitchLineShown} />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { PitchLineSwitch };
