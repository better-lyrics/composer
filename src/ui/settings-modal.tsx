import { useTypeToSearch } from "@/hooks/useTypeToSearch";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/stores/settings-catalog";
import { useUIStore } from "@/stores/ui";
import { withMatchCounts } from "@/ui/nav-match-counts";
import { Modal } from "@/ui/modal";
import { ModalNavLayout, type ModalNavSection } from "@/ui/modal-nav-layout";
import { revealElement } from "@/ui/reveal-element";
import { SearchField } from "@/ui/search-field";
import { ConfirmationsSection } from "@/ui/settings/confirmations-section";
import { BackToHelpChip } from "@/ui/settings/back-to-help-chip";
import { GeneralSection } from "@/ui/settings/general-section";
import { countMatchesBySection, searchSettings } from "@/ui/settings/search-settings";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";
import { SettingsSearchResults } from "@/ui/settings/settings-search-results";
import { SETTINGS_SECTION_ICONS } from "@/ui/settings/settings-section-icons";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

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

const SettingsModalBody: React.FC<{ onResetTour: () => void; onClose: () => void }> = ({ onResetTour, onClose }) => {
  const settingsSection = useUIStore((s) => s.settingsSection);
  const settingsTarget = useUIStore((s) => s.settingsTarget);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const settingsQuery = useUIStore((s) => s.settingsQuery);
  const setSettingsQuery = useUIStore((s) => s.setSettingsQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchSettings(settingsQuery), [settingsQuery]);

  useTypeToSearch(searchInputRef, settingsQuery, setSettingsQuery);

  const revealPendingTarget = useCallback(() => {
    const viewport = viewportRef.current;
    const { settingsTarget: target, consumeSettingsTarget } = useUIStore.getState();
    if (!viewport || !target) return;
    const row =
      "setting" in target ? viewport.querySelector<HTMLElement>(`[data-setting-id="${target.setting}"]`) : null;
    if (row) revealElement(viewport, row);
    consumeSettingsTarget();
  }, []);

  useLayoutEffect(() => {
    if (settingsTarget) revealPendingTarget();
  }, [settingsTarget, revealPendingTarget]);

  useLayoutEffect(() => {
    if (settingsQuery) viewportRef.current?.scrollTo({ top: 0 });
  }, [settingsQuery]);

  const navSections = useMemo(
    () => (results ? withMatchCounts(NAV_SECTIONS, countMatchesBySection(results)) : NAV_SECTIONS),
    [results],
  );

  return (
    <>
      <ModalNavLayout
        sections={navSections}
        activeSection={results ? null : settingsSection}
        onSectionChange={setSettingsSection}
        sidebarHeader={
          <SearchField
            label="Search settings"
            value={settingsQuery}
            onChange={setSettingsQuery}
            inputRef={searchInputRef}
          />
        }
        contentClassName="px-6 py-2"
        contentViewportRef={viewportRef}
        onContentInitialized={revealPendingTarget}
      >
        <div data-settings-content>
          <SettingsSearchQueryContext value={settingsQuery}>
            {results ? (
              <SettingsSearchResults results={results} />
            ) : (
              <SectionContent section={settingsSection} onResetTour={onResetTour} onClose={onClose} />
            )}
          </SettingsSearchQueryContext>
        </div>
      </ModalNavLayout>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none">
        Settings are saved automatically
      </div>
    </>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetTour }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Settings"
    headerAccessory={<BackToHelpChip />}
    className="max-w-3xl h-[70%] flex flex-col"
    bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
  >
    <SettingsModalBody onResetTour={onResetTour} onClose={onClose} />
  </Modal>
);

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
