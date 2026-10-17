import type { SettingsState } from "@/stores/settings";
import { SETTINGS_CATALOG } from "@/stores/settings-catalog-entries";

// -- Types --------------------------------------------------------------------

type SettingsSectionId =
  | "general"
  | "projects"
  | "theme"
  | "playback"
  | "timeline"
  | "sync"
  | "shortcuts"
  | "confirmations"
  | "storage"
  | "advanced";

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
}

type SettingsGroupId = "Usage" | "Audio" | "Saving";

interface SettingEntryCommon {
  section: SettingsSectionId;
  label: string;
  keywords?: readonly string[];
  settingKey?: keyof SettingsState;
  readOn?: (state: SettingsState) => boolean;
  group?: SettingsGroupId;
  visibleWhen?: (state: SettingsState) => boolean;
}

type SettingEntry =
  | (SettingEntryCommon & { description: string; descriptionFor?: never })
  | (SettingEntryCommon & { description?: never; descriptionFor: (state: SettingsState) => string });

// -- Sections -----------------------------------------------------------------

const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: "general", label: "General" },
  { id: "projects", label: "Projects" },
  { id: "theme", label: "Theme" },
  { id: "playback", label: "Playback" },
  { id: "timeline", label: "Timeline" },
  { id: "sync", label: "Sync & Timing" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "confirmations", label: "Confirmations" },
  { id: "storage", label: "Save & Storage" },
  { id: "advanced", label: "Advanced" },
];

type SettingId = keyof typeof SETTINGS_CATALOG;

interface SettingHint {
  text: string;
  setting: SettingId;
}

const SETTING_IDS = Object.keys(SETTINGS_CATALOG) as readonly SettingId[];

// -- Lookups ------------------------------------------------------------------

function settingEntry(id: SettingId): SettingEntry {
  return SETTINGS_CATALOG[id];
}

function sectionLabel(section: SettingsSectionId): string {
  return SETTINGS_SECTIONS.find((candidate) => candidate.id === section)?.label ?? section;
}

function settingIdsInSection(section: SettingsSectionId): SettingId[] {
  return SETTING_IDS.filter((id) => settingEntry(id).section === section);
}

function settingKeyOf(id: SettingId): keyof SettingsState {
  const key = settingEntry(id).settingKey;
  if (key === undefined) throw new Error(`Setting "${id}" has no store key`);
  return key;
}

function readSettingOn(id: SettingId, state: SettingsState): boolean | null {
  const entry = settingEntry(id);
  if (entry.readOn) return entry.readOn(state);
  if (entry.settingKey === undefined) return null;
  const value = state[entry.settingKey];
  return typeof value === "boolean" ? value : null;
}

function settingDescription(id: SettingId, state: SettingsState): string {
  const entry = settingEntry(id);
  return entry.descriptionFor ? entry.descriptionFor(state) : entry.description;
}

function isSettingVisible(id: SettingId, state: SettingsState): boolean {
  const { visibleWhen } = settingEntry(id);
  return visibleWhen ? visibleWhen(state) : true;
}

function visibleSettingIds(ids: readonly SettingId[], state: SettingsState): SettingId[] {
  return ids.filter((id) => isSettingVisible(id, state));
}

// -- Exports ------------------------------------------------------------------

export {
  SETTING_IDS,
  SETTINGS_SECTIONS,
  isSettingVisible,
  readSettingOn,
  sectionLabel,
  settingDescription,
  settingEntry,
  settingIdsInSection,
  settingKeyOf,
  visibleSettingIds,
};
export type { SettingEntry, SettingHint, SettingId, SettingsGroupId, SettingsSectionId };
