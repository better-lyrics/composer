import type { SettingId } from "@/stores/settings-catalog";
import { SelectSetting, SliderSetting, ToggleSetting } from "@/ui/settings/setting-controls";
import { SETTING_CONTROLS } from "@/ui/settings/setting-controls-registry";

// -- Components ----------------------------------------------------------------

const SettingControlView: React.FC<{ id: SettingId }> = ({ id }) => {
  const control = SETTING_CONTROLS[id];
  switch (control.kind) {
    case "toggle":
      return <ToggleSetting id={id} />;
    case "slider":
      return (
        <SliderSetting
          id={id}
          min={control.min}
          max={control.max}
          step={control.step}
          format={control.format}
          action={control.action}
        />
      );
    case "select":
      return <SelectSetting id={id} options={control.options} />;
    case "custom": {
      const { Component } = control;
      return <Component />;
    }
  }
};

const SettingRow: React.FC<{ id: SettingId }> = ({ id }) => (
  <div data-setting-id={id} className="relative">
    <SettingControlView id={id} />
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SettingRow };
