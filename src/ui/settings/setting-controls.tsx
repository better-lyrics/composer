import { Slider } from "@/ui/slider";
import { useSettingsStore } from "@/stores/settings";
import { type SettingId, settingEntry, settingKeyOf } from "@/stores/settings-catalog";
import { Select } from "@/ui/select";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { Switch } from "@/ui/switch";
import { useId } from "react";

// -- Types ---------------------------------------------------------------------

interface SliderAction {
  label: string;
  onClick: () => void;
}

interface SelectOption {
  value: string;
  label: string;
}

interface SliderSettingProps {
  id: SettingId;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  action?: SliderAction;
}

// -- Setting Controls ----------------------------------------------------------

const SliderSetting: React.FC<SliderSettingProps> = ({ id, min, max, step, format, action }) => {
  const settingKey = settingKeyOf(id);
  const stored = useSettingsStore((s) => s[settingKey]);
  const set = useSettingsStore((s) => s.set);
  const value = typeof stored === "number" ? stored : min;

  return (
    <div className="flex flex-col gap-3 py-3.5 -mx-2.5 px-2.5 rounded-[10px] transition-colors has-[:not(input,textarea):focus-visible]:bg-(--focus-tint)">
      <SettingRowLayout className="py-0 mx-0 px-0 has-[:not(input,textarea):focus-visible]:bg-transparent">
        <SettingText id={id} />
        <div className="flex items-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="text-[12.5px] text-composer-accent-text hover:underline cursor-pointer"
            >
              {action.label}
            </button>
          )}
          <span className="text-[13px] font-medium font-mono text-composer-text tabular-nums min-w-16 text-right">
            {format ? format(value) : value}
          </span>
        </div>
      </SettingRowLayout>
      <Slider
        aria-label={settingEntry(id).label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(next) => set(settingKey, next)}
        className="w-full"
      />
    </div>
  );
};

const ToggleSetting: React.FC<{ id: SettingId }> = ({ id }) => {
  const settingKey = settingKeyOf(id);
  const isOn = useSettingsStore((s) => s[settingKey] === true);
  const set = useSettingsStore((s) => s.set);

  return (
    <SettingRowLayout>
      <SettingText id={id} />
      <Switch checked={isOn} label={settingEntry(id).label} onCheckedChange={(checked) => set(settingKey, checked)} />
    </SettingRowLayout>
  );
};

const SelectSetting: React.FC<{ id: SettingId; options: SelectOption[] }> = ({ id, options }) => {
  const settingKey = settingKeyOf(id);
  const value = useSettingsStore((s) => String(s[settingKey]));
  const set = useSettingsStore((s) => s.set);

  return (
    <SettingRowLayout>
      <SettingText id={id} />
      <Select
        aria-label={settingEntry(id).label}
        value={value}
        onChange={(next) => set(settingKey, next)}
        options={options}
        className="h-9 pl-3 pr-[5px] rounded-xl border-transparent hover:border-transparent btn-raised [&>svg]:size-3.5"
      />
    </SettingRowLayout>
  );
};

const SettingsGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mt-[18px] mb-0.5 text-xs font-semibold text-(--muted) select-none">
        {title}
      </h3>
      <div className="divide-y divide-(--divider)">{children}</div>
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { SelectSetting, SettingsGroup, SliderSetting, ToggleSetting };
export type { SelectOption, SliderAction };
