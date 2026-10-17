import { SETTINGS_SECTIONS, type SettingId, type SettingsSectionId, settingEntry } from "@/stores/settings-catalog";
import type { ShortcutDefinition } from "@/stores/shortcut-registry";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { NoMatches } from "@/ui/no-matches";
import { SearchResultGroupHeader } from "@/ui/search-result-group-header";
import type { SettingsSearchResult } from "@/ui/settings/search-settings";
import { SettingRow } from "@/ui/settings/setting-row";
import { useSettingsSearchQuery } from "@/ui/settings/settings-search-query";
import { SETTINGS_SECTION_ICONS } from "@/ui/settings/settings-section-icons";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";

// -- Types ---------------------------------------------------------------------

interface ResultGroup {
  section: SettingsSectionId;
  label: string;
  settings: SettingId[];
  shortcuts: ShortcutDefinition[];
}

// -- Helpers -------------------------------------------------------------------

function groupResults(results: SettingsSearchResult): ResultGroup[] {
  return SETTINGS_SECTIONS.flatMap(({ id, label }) => {
    const settings = results.settings.filter((settingId) => settingEntry(settingId).section === id);
    const shortcuts = id === "shortcuts" ? results.shortcuts : [];
    return settings.length + shortcuts.length > 0 ? [{ section: id, label, settings, shortcuts }] : [];
  });
}

// -- Components ----------------------------------------------------------------

const SettingsSearchResults: React.FC<{ results: SettingsSearchResult }> = ({ results }) => {
  const query = useSettingsSearchQuery();
  const setSettingsQuery = useUIStore((s) => s.setSettingsQuery);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);
  const groups = groupResults(results);

  if (groups.length === 0) {
    return (
      <div className="flex py-12">
        <NoMatches
          size="large"
          message={`No settings match "${query.trim()}"`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setSettingsQuery("")}>
              Clear search
            </Button>
          }
        />
      </div>
    );
  }

  return groups.map((group) => (
    <section key={group.section} aria-label={group.label}>
      <SearchResultGroupHeader
        icon={SETTINGS_SECTION_ICONS[group.section]}
        label={group.label}
        onOpenSection={() => setSettingsSection(group.section)}
      />
      <div className="divide-y divide-composer-border">
        {group.settings.map((id) => (
          <SettingRow key={id} id={id} />
        ))}
        {group.shortcuts.map((definition) => (
          <ShortcutRebindRow key={definition.id} definition={definition} />
        ))}
      </div>
    </section>
  ));
};

// -- Exports -------------------------------------------------------------------

export { SettingsSearchResults };
