import type { SettingsState } from "@/stores/settings";
import {
  SETTING_IDS,
  type SettingId,
  type SettingsSectionId,
  sectionLabel,
  settingDescription,
  settingEntry,
  visibleSettingIds,
} from "@/stores/settings-catalog";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { SHORTCUT_SCOPE_GROUPS, type ShortcutDefinition, getShortcutsByScope } from "@/stores/shortcut-registry";
import { matchesAllTerms, splitSearchTerms } from "@/utils/search-terms";

// -- Types ---------------------------------------------------------------------

interface SettingsSearchResult {
  settings: SettingId[];
  shortcuts: ShortcutDefinition[];
}

// -- Haystacks -----------------------------------------------------------------

function settingHaystack(id: SettingId, state: SettingsState): string {
  const { label, keywords = [], section } = settingEntry(id);
  return [label, settingDescription(id, state), ...keywords, sectionLabel(section)].join(" ");
}

function shortcutHaystack(definition: ShortcutDefinition, scopeTitle: string): string {
  return [definition.description, definition.id, scopeTitle, getEffectiveKeysArray(definition.id).join(" ")].join(" ");
}

// -- Search --------------------------------------------------------------------

function searchSettings(query: string, state: SettingsState): SettingsSearchResult | null {
  const terms = splitSearchTerms(query);
  if (terms.length === 0) return null;
  return {
    settings: visibleSettingIds(SETTING_IDS, state).filter((id) => matchesAllTerms(settingHaystack(id, state), terms)),
    shortcuts: SHORTCUT_SCOPE_GROUPS.flatMap(({ scope, title }) =>
      getShortcutsByScope(scope).filter((definition) => matchesAllTerms(shortcutHaystack(definition, title), terms)),
    ),
  };
}

function countMatchesBySection(result: SettingsSearchResult): Partial<Record<SettingsSectionId, number>> {
  const counts: Partial<Record<SettingsSectionId, number>> = {};
  for (const id of result.settings) {
    const { section } = settingEntry(id);
    counts[section] = (counts[section] ?? 0) + 1;
  }
  if (result.shortcuts.length > 0) counts.shortcuts = result.shortcuts.length;
  return counts;
}

// -- Exports -------------------------------------------------------------------

export { countMatchesBySection, searchSettings };
export type { SettingsSearchResult };
