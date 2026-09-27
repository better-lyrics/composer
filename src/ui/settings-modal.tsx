import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/stores/settings-catalog";
import { useUIStore } from "@/stores/ui";
import { Modal } from "@/ui/modal";
import { ModalNavLayout, type ModalNavSection } from "@/ui/modal-nav-layout";
import { ConfirmationsSection } from "@/ui/settings/confirmations-section";
import { GeneralSection } from "@/ui/settings/general-section";
import { SETTINGS_SECTION_ICONS } from "@/ui/settings/settings-section-icons";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetTour: () => void;
}

// -- Sections -----------------------------------------------------------------

const NAV_SECTIONS: readonly ModalNavSection<SettingsSectionId>[] = SETTINGS_SECTIONS.map(({ id, label }) => ({
  id,
  label,
  icon: SETTINGS_SECTION_ICONS[id],
}));

const SectionContent: React.FC<{ section: SettingsSectionId; onResetTour: () => void; onClose: () => void }> = ({
  section,
  onResetTour,
  onClose,
}) => {
  switch (section) {
    case "general":
      return <GeneralSection onResetTour={onResetTour} onClose={onClose} />;
    case "shortcuts":
      return <ShortcutsSettingsSection />;
    case "confirmations":
      return <ConfirmationsSection />;
    default:
      return <SettingsSectionRows section={section} />;
  }
};

// -- Settings Modal -----------------------------------------------------------

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetTour }) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(() =>
    useUIStore.getState().settingsHighlight === "bridge-section" ? "advanced" : "general",
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-3xl h-[70%] flex flex-col"
      bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
    >
      <ModalNavLayout
        sections={NAV_SECTIONS}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        contentClassName="px-6 py-2"
      >
        <SectionContent section={activeSection} onResetTour={onResetTour} onClose={onClose} />
      </ModalNavLayout>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none">
        Settings are saved automatically
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
