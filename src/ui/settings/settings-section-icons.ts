import type { SettingsSectionId } from "@/stores/settings-catalog";
import type { ModalNavSection } from "@/ui/modal-nav-layout";
import {
  IconAlertTriangle,
  IconClock,
  IconDeviceFloppy,
  IconKeyboard,
  IconLayoutList,
  IconLayoutRows,
  IconPalette,
  IconPlayerPlay,
  IconPlugConnected,
  IconSettings,
} from "@tabler/icons-react";

// -- Icons ---------------------------------------------------------------------

const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, ModalNavSection["icon"]> = {
  general: IconSettings,
  projects: IconLayoutList,
  theme: IconPalette,
  playback: IconPlayerPlay,
  timeline: IconLayoutRows,
  sync: IconClock,
  shortcuts: IconKeyboard,
  confirmations: IconAlertTriangle,
  storage: IconDeviceFloppy,
  advanced: IconPlugConnected,
};

// -- Exports -------------------------------------------------------------------

export { SETTINGS_SECTION_ICONS };
