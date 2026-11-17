import { pluralWord, pluralize } from "insync/pluralize";
import { type BooleanSettingKey, useSettingsStore } from "@/stores/settings";
import { useExtractOptions } from "@/stores/settings-extract-options";
import { BACKGROUND_SEPARATOR_OPTIONS } from "@/ui/background-separator-options";
import { PopBody, PopButton, PopGroup, PopHead, PopRow } from "@/ui/pop-layout";
import { SegmentedControl } from "@/ui/segmented-control";
import { Switch } from "@/ui/switch";
import { BracketsExample } from "@/views/edit/brackets-example";
import { type Icon, IconBracketsContain, IconCornerLeftUp, IconMicrophone, IconSpace } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BracketsSettingsProps {
  extractableCount: number;
  onExtract: () => void;
}

interface SettingSwitchRowProps {
  setting: BooleanSettingKey;
  label: string;
  hint: string;
  icon: Icon;
}

// -- Helpers -------------------------------------------------------------------

function bracketsLeftStatus(count: number): string {
  if (count === 0) return "No ( ) left in the lyrics";
  return `${pluralize(count, "line")} ${pluralWord(count, "still has", "still have")} ( )`;
}

// -- Components ----------------------------------------------------------------

const SettingSwitchRow: React.FC<SettingSwitchRowProps> = ({ setting, label, hint, icon }) => {
  const checked = useSettingsStore((s) => s[setting]);
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
  return (
    <PopRow label="Separate with" hint="When a line has more than one ( )" icon={IconSpace}>
      <SegmentedControl
        size="sm"
        aria-label="Separate with"
        value={separator}
        options={BACKGROUND_SEPARATOR_OPTIONS}
        onChange={(next) => useSettingsStore.getState().set("backgroundSeparator", next)}
      />
    </PopRow>
  );
};

const PopDivider: React.FC = () => <div className="h-px my-1.5 -mx-1.5 bg-(--divider)" />;

const BracketsSettings: React.FC<BracketsSettingsProps> = ({ extractableCount, onExtract }) => {
  const options = useExtractOptions();
  return (
    <PopBody>
      <PopHead title="Brackets" />
      <PopGroup label="As you type" className="mt-2.5">
        <SettingSwitchRow
          setting="autoExtractBackgroundVocals"
          label="Auto-extract background vocals"
          hint="Moves ( ) to the background when you close it"
          icon={IconMicrophone}
        />
      </PopGroup>
      <PopGroup label="Typing or the Extract button" className="mt-2">
        <SettingSwitchRow
          setting="mergeStandaloneBackgroundLines"
          label="Merge standalone background lines"
          hint="A line that is only ( ) joins the line above"
          icon={IconCornerLeftUp}
        />
        <SettingSwitchRow
          setting="preserveBracketsOnExtraction"
          label="Preserve brackets"
          hint="Background vocals keep their ( )"
          icon={IconBracketsContain}
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
          {bracketsLeftStatus(extractableCount)}
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
