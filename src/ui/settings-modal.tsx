import { ConfirmationsSettingsSection } from "@/ui/confirmations-settings-section";
import { Modal } from "@/ui/modal";
import { Scroll } from "@/ui/scroll";
import { AdvancedSection } from "@/ui/settings/advanced-section";
import { GeneralSection } from "@/ui/settings/general-section";
import { PlaybackSection } from "@/ui/settings/playback-section";
import { StorageSection } from "@/ui/settings/storage-section";
import { SyncSection } from "@/ui/settings/sync-section";
import { TimelineSection } from "@/ui/settings/timeline-section";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import { cn } from "@/utils/cn";
import {
  IconAlertTriangle,
  IconClock,
  IconDeviceFloppy,
  IconKeyboard,
  IconLayoutRows,
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

interface SectionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

// -- Sections -----------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  { id: "general", label: "General", icon: IconSettings },
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
  confirmations: ConfirmationsSettingsSection,
  storage: StorageSection,
  advanced: AdvancedSection,
  general: GeneralSection,
};

// -- Settings Modal -----------------------------------------------------------

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetTour }) => {
  const [activeSection, setActiveSection] = useState("general");

  const Content = SECTION_CONTENT[activeSection];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-3xl h-[70%] flex flex-col"
      bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
    >
      <div className="flex flex-1 min-h-0">
        <Scroll className="w-44 shrink-0 border-r border-composer-border select-none">
          <div className="flex flex-col gap-px p-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors",
                    isActive
                      ? "bg-composer-button text-composer-text font-medium"
                      : "text-composer-text-secondary hover:bg-composer-button/50 hover:text-composer-text",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </Scroll>

        <Scroll className="flex-1 px-6 py-2">
          {Content && <Content onResetTour={onResetTour} onClose={onClose} />}
        </Scroll>
      </div>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none">
        Settings are saved automatically
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
