import { type SettingsSectionId, settingIdsInSection } from "@/stores/settings-catalog";
import { SettingRow } from "@/ui/settings/setting-row";

// -- Component -----------------------------------------------------------------

const SettingsSectionRows: React.FC<{ section: SettingsSectionId }> = ({ section }) => (
  <div className="divide-y divide-composer-border">
    {settingIdsInSection(section).map((id) => (
      <SettingRow key={id} id={id} />
    ))}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SettingsSectionRows };
