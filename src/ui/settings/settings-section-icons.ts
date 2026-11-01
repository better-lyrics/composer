import type { SettingsSectionId } from "@/stores/settings-catalog";
import type { ModalNavSection } from "@/ui/modal-nav-layout";
import {
  IconAlertTriangle,
  IconClock,
  IconCpu,
  IconDeviceFloppy,
  IconFileText,
  IconGrain,
  IconKeyboard,
  IconLayoutRows,
  IconMagnet,
  IconPalette,
  IconPencilCog,
  IconPlayerPlay,
  IconPlugConnected,
  IconSettings,
} from "@tabler/icons-react";

// -- Icons ---------------------------------------------------------------------

const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, ModalNavSection["icon"]> = {
  changed: IconPencilCog,
  general: IconSettings,
  theme: IconPalette,
  shortcuts: IconKeyboard,
  confirmations: IconAlertTriangle,
  lyrics: IconFileText,
  playback: IconPlayerPlay,
  sync: IconClock,
  timeline: IconLayoutRows,
  snap: IconMagnet,
  spectrum: IconGrain,
  storage: IconDeviceFloppy,
  models: IconCpu,
  advanced: IconPlugConnected,
};

// -- Exports -------------------------------------------------------------------

export { SETTINGS_SECTION_ICONS };
