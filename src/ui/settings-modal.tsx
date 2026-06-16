import { useUIStore } from "@/stores/ui";
import { Modal } from "@/ui/modal";
import { ModalNavLayout, type ModalNavSection } from "@/ui/modal-nav-layout";
import { AdvancedSection } from "@/ui/settings/advanced-section";
import { ConfirmationsSection } from "@/ui/settings/confirmations-section";
import { GeneralSection } from "@/ui/settings/general-section";
import { PlaybackSection } from "@/ui/settings/playback-section";
import { StorageSection } from "@/ui/settings/storage-section";
import { SyncSection } from "@/ui/settings/sync-section";
import { ThemeSection } from "@/ui/settings/theme-section";
import { TimelineSection } from "@/ui/settings/timeline-section";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import {
  IconAlertTriangle,
  IconClock,
  IconDeviceFloppy,
  IconKeyboard,
  IconLayoutRows,
  IconPalette,
  IconPlayerPlay,
  IconPlugConnected,
  IconSettings,
} from "@tabler/icons-react";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetTour: () => void;
}

// -- Sections -----------------------------------------------------------------

const SECTIONS: ModalNavSection[] = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "theme", label: "Theme", icon: IconPalette },
  { id: "playback", label: "Playback", icon: IconPlayerPlay },
  { id: "timeline", label: "Timeline", icon: IconLayoutRows },
  { id: "sync", label: "Sync & Timing", icon: IconClock },
  { id: "shortcuts", label: "Shortcuts", icon: IconKeyboard },
  { id: "confirmations", label: "Confirmations", icon: IconAlertTriangle },
  { id: "storage", label: "Save & Storage", icon: IconDeviceFloppy },
  { id: "advanced", label: "Advanced", icon: IconPlugConnected },
];

// -- Section Map --------------------------------------------------------------

const SECTION_CONTENT: Record<string, React.FC<{ onResetTour: () => void; onClose: () => void }>> = {
  playback: PlaybackSection,
  timeline: TimelineSection,
  sync: SyncSection,
  shortcuts: ShortcutsSettingsSection,
  confirmations: ConfirmationsSection,
  storage: StorageSection,
  advanced: AdvancedSection,
  general: GeneralSection,
  theme: ThemeSection,
};

// -- Settings Modal -----------------------------------------------------------

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetTour }) => {
  const [activeSection, setActiveSection] = useState(() =>
    useUIStore.getState().settingsHighlight === "bridge-section" ? "advanced" : "general",
  );

  const Content = SECTION_CONTENT[activeSection];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-3xl h-[70%] flex flex-col"
      bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
    >
      <ModalNavLayout
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        contentClassName="px-6 py-2"
      >
        {Content && <Content onResetTour={onResetTour} onClose={onClose} />}
      </ModalNavLayout>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none">
        Settings are saved automatically
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
