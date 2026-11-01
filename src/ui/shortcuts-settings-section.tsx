import { SHORTCUT_SCOPE_GROUPS, getShortcutsByScope } from "@/stores/shortcut-registry";
import { SettingRow } from "@/ui/settings/setting-row";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";

// -- Component ----------------------------------------------------------------

const ShortcutsSettingsSection: React.FC = () => (
  <div className="space-y-6 py-4">
    <SettingRow id="shortcutPreset" />
    {SHORTCUT_SCOPE_GROUPS.map(({ scope, title }) => (
      <div key={scope}>
        <h3 className="mb-1 text-xs font-medium tracking-wide text-composer-text-muted">{title}</h3>
        <div className="divide-y divide-composer-border">
          {getShortcutsByScope(scope).map((def) => (
            <ShortcutRebindRow key={def.id} definition={def} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ShortcutsSettingsSection };
