import type { SettingHint as SettingHintValue } from "@/stores/settings-catalog";
import { SettingLink } from "@/ui/setting-link";

// -- Component -----------------------------------------------------------------

const SettingHint: React.FC<{ hint: SettingHintValue }> = ({ hint }) => (
  <span>
    {hint.text} <SettingLink setting={hint.setting} />
  </span>
);

// -- Exports -------------------------------------------------------------------

export { SettingHint };
