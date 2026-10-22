import { useScrollTopOnSearch } from "@/hooks/useScrollTopOnSearch";
import { useTrackedScrollTop } from "@/hooks/useTrackedScrollTop";
import { useTypeToSearch } from "@/hooks/useTypeToSearch";
import { useSettingsStore } from "@/stores/settings";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/stores/settings-catalog";
import { useUIStore } from "@/stores/ui";
import { Modal } from "@/ui/modal";
import { ModalNavLayout, type ModalNavSection } from "@/ui/modal-nav-layout";
import { withMatchCounts } from "@/ui/nav-match-counts";
import { revealElement } from "@/ui/reveal-element";
import { SearchField } from "@/ui/search-field";
import { BackToHelpChip } from "@/ui/settings/back-to-help-chip";
import { ConfirmationsSection } from "@/ui/settings/confirmations-section";
import { countMatchesBySection, searchSettings } from "@/ui/settings/search-settings";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";
import { SettingsSearchResults } from "@/ui/settings/settings-search-results";
import { SETTINGS_SECTION_ICONS } from "@/ui/settings/settings-section-icons";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// -- Sections -----------------------------------------------------------------

const NAV_SECTIONS: readonly ModalNavSection<SettingsSectionId>[] = SETTINGS_SECTIONS.map(({ id, label }) => ({
  id,
  label,
  icon: SETTINGS_SECTION_ICONS[id],
}));

const SectionContent: React.FC<{ section: SettingsSectionId }> = ({ section }) => {
  switch (section) {
    case "shortcuts":
      return <ShortcutsSettingsSection />;
    case "confirmations":
      return <ConfirmationsSection />;
    default:
      return <SettingsSectionRows section={section} />;
  }
};

// -- Settings Modal -----------------------------------------------------------

const SettingsModalBody: React.FC = () => {
  const settingsSection = useUIStore((s) => s.settingsSection);
  const settingsTarget = useUIStore((s) => s.settingsTarget);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const settingsQuery = useUIStore((s) => s.settingsQuery);
  const setSettingsQuery = useUIStore((s) => s.setSettingsQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settingsState = useSettingsStore((s) => s);
  const results = useMemo(() => searchSettings(settingsQuery, settingsState), [settingsQuery, settingsState]);

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

  const [initialScrollTop] = useState(() => useUIStore.getState().settingsScrollTop);
  const [scrollTopRef, trackScrollTop] = useTrackedScrollTop(initialScrollTop);
  useLayoutEffect(() => () => useUIStore.getState().rememberSettingsScrollTop(scrollTopRef.current), [scrollTopRef]);
  useScrollTopOnSearch(viewportRef, settingsQuery);

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
        contentClassName="px-6 pt-1 pb-4"
        contentInitialScrollTop={initialScrollTop}
        contentViewportRef={viewportRef}
        onContentInitialized={revealPendingTarget}
        onContentScrollTopChange={trackScrollTop}
      >
        <div data-settings-content>
          <SettingsSearchQueryContext value={settingsQuery}>
            {results ? <SettingsSearchResults results={results} /> : <SectionContent section={settingsSection} />}
          </SettingsSearchQueryContext>
        </div>
      </ModalNavLayout>

      <div className="flex items-center justify-center gap-1.5 h-11 px-5 border-t border-(--divider) text-[12.5px] text-(--muted) shrink-0 select-none">
        Settings are saved automatically
      </div>
    </>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Settings"
    headerAccessory={<BackToHelpChip />}
    className="max-w-3xl h-[min(70vh,640px)] flex flex-col"
    bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
  >
    <SettingsModalBody />
  </Modal>
);

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
