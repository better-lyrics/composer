import { SHORTCUT_SCOPE_GROUPS, getShortcutsByScope } from "@/stores/shortcut-registry";
import { SettingsGroup } from "@/ui/settings/setting-controls";
import { SettingRow } from "@/ui/settings/setting-row";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";

// -- Component ----------------------------------------------------------------

const ShortcutsSettingsSection: React.FC = () => (
  <div className="py-4">
    <SettingRow id="shortcutPreset" />
    {SHORTCUT_SCOPE_GROUPS.map(({ scope, title }) => (
      <SettingsGroup key={scope} title={title}>
        {getShortcutsByScope(scope).map((def) => (
          <ShortcutRebindRow key={def.id} definition={def} />
        ))}
      </SettingsGroup>
    ))}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ShortcutsSettingsSection };
