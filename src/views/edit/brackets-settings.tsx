import { type BooleanSettingKey, useSettingsStore } from "@/stores/settings";
import { type SettingId, settingEntry } from "@/stores/settings-catalog";
import { useExtractOptions } from "@/stores/settings-extract-options";
import { BACKGROUND_SEPARATOR_OPTIONS } from "@/ui/background-separator-options";
import { PopBody, PopButton, PopGroup, PopHead, PopRow } from "@/ui/pop-layout";
import { SegmentedControl } from "@/ui/segmented-control";
import { Switch } from "@/ui/switch";
import { BracketsExample } from "@/views/edit/brackets-example";
import { bracketsStatus } from "@/views/edit/brackets-status";
import { type Icon, IconCornerLeftUp, IconMicrophone, IconSpace } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BracketsSettingsProps {
  extractableCount: number;
  keptAsTextCount: number;
  onExtract: () => void;
}

interface SettingSwitchRowProps {
  setting: BooleanSettingKey & SettingId;
  hint: string;
  icon: Icon;
}

// -- Components ----------------------------------------------------------------

const SettingSwitchRow: React.FC<SettingSwitchRowProps> = ({ setting, hint, icon }) => {
  const checked = useSettingsStore((s) => s[setting]);
  const { label } = settingEntry(setting);
  return (
    <PopRow label={label} hint={hint} icon={icon} labelsControl>
      <Switch
        checked={checked}
        label={label}
        onCheckedChange={(next) => useSettingsStore.getState().set(setting, next)}
      />
    </PopRow>
  );
};

const SeparatorRow: React.FC = () => {
  const separator = useSettingsStore((s) => s.backgroundSeparator);
  const { label } = settingEntry("backgroundSeparator");
  return (
    <PopRow label={label} hint="When a line has more than one ( )" icon={IconSpace}>
      <SegmentedControl
        size="sm"
        aria-label={label}
        value={separator}
        options={BACKGROUND_SEPARATOR_OPTIONS}
        onChange={(next) => useSettingsStore.getState().set("backgroundSeparator", next)}
      />
    </PopRow>
  );
};

const PopDivider: React.FC = () => <div className="h-px my-1.5 -mx-1.5 bg-(--divider)" />;

const BracketsSettings: React.FC<BracketsSettingsProps> = ({ extractableCount, keptAsTextCount, onExtract }) => {
  const options = useExtractOptions();
  return (
    <PopBody>
      <PopHead title="Brackets" />
      <PopGroup label="As you type" className="mt-2.5">
        <SettingSwitchRow
          setting="autoExtractBackgroundVocals"
          hint="Moves ( ) to the background when you close it"
          icon={IconMicrophone}
        />
      </PopGroup>
      <PopGroup label="When brackets are extracted" className="mt-2">
        <SettingSwitchRow
          setting="mergeStandaloneBackgroundLines"
          hint="A line that is only ( ) joins the line above"
          icon={IconCornerLeftUp}
        />
        <SeparatorRow />
      </PopGroup>
      <PopDivider />
      <PopGroup label="Example" className="mt-0">
        <BracketsExample options={options} />
      </PopGroup>
      <PopDivider />
      <div className="flex items-center justify-between gap-3 h-9 pl-2.5 pr-1">
        <span role="status" className="flex-1 min-w-0 truncate text-[12.5px] tabular-nums text-(--muted)">
          {bracketsStatus(extractableCount, keptAsTextCount)}
        </span>
        <PopButton icon={IconMicrophone} disabled={extractableCount === 0} onClick={onExtract}>
          Extract now
        </PopButton>
      </div>
    </PopBody>
  );
};

// -- Exports -------------------------------------------------------------------

export { BracketsSettings };
