import { useScrollTopOnSearch } from "@/hooks/useScrollTopOnSearch";
import { useTrackedScrollTop } from "@/hooks/useTrackedScrollTop";
import { useTypeToSearch } from "@/hooks/useTypeToSearch";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { type HelpLocation, useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { HelpSearchResults } from "@/ui/help-search/help-search-results";
import { HelpSectionContent } from "@/ui/help-sections";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { Modal } from "@/ui/modal";
import { ModalNavLayout } from "@/ui/modal-nav-layout";
import { withMatchCounts } from "@/ui/nav-match-counts";
import { NoMatchMessage } from "@/ui/no-match-message";
import { NoMatches } from "@/ui/no-matches";
import { revealElement } from "@/ui/reveal-element";
import { SearchField } from "@/ui/search-field";
import { SettingLinkContext, type SettingLinkHost } from "@/ui/setting-link-context";
import { splitSearchTerms } from "@/utils/search-terms";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface HelpModalProps {
  isOpen: boolean;
  initialSection?: string;
  initialScrollTop?: number;
  initialQuery?: string;
  onClose: () => void;
}

type HelpModalBodyProps = Omit<HelpModalProps, "isOpen" | "onClose">;

interface PendingTopic {
  section: string;
  title: string;
}

// -- Help Modal ---------------------------------------------------------------

const HelpModalBody: React.FC<HelpModalBodyProps> = ({ initialSection, initialScrollTop = 0, initialQuery = "" }) => {
  const [activeSection, setActiveSection] = useState(initialSection ?? "getting-started");
  const [query, setQuery] = useState(initialQuery);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingTopicRef = useRef<PendingTopic | null>(null);
  const terms = useMemo(() => splitSearchTerms(query), [query]);
  const isSearching = terms.length > 0;

  useTypeToSearch(searchInputRef, query, setQuery);

  const [scrollTopRef, trackScrollTop] = useTrackedScrollTop(initialScrollTop);

  const currentLocation = useCallback(
    (): HelpLocation => ({
      section: activeSection,
      scrollTop: scrollTopRef.current,
      ...(query.trim() ? { query } : {}),
    }),
    [activeSection, query, scrollTopRef],
  );
  const linkHost = useMemo<SettingLinkHost>(() => ({ returnPoint: currentLocation }), [currentLocation]);

  useLayoutEffect(() => () => useUIStore.getState().rememberHelpLocation(currentLocation()), [currentLocation]);

  const openSection = useCallback((section: string) => {
    setQuery("");
    setActiveSection(section);
    viewportRef.current?.scrollTo({ top: 0 });
  }, []);

  const openTopic = useCallback((section: string, title: string) => {
    pendingTopicRef.current = { section, title };
    setQuery("");
    setActiveSection(section);
  }, []);

  useScrollTopOnSearch(viewportRef, query);

  const shownContentRef = useRef({ activeSection, isSearching });

  const revealPendingTopic = useCallback(() => {
    const pending = pendingTopicRef.current;
    const viewport = viewportRef.current;
    const { activeSection: shownSection, isSearching: showingResults } = shownContentRef.current;
    if (!pending || showingResults || !viewport || pending.section !== shownSection) return;
    pendingTopicRef.current = null;
    const topic = viewport.querySelector<HTMLElement>(`[data-help-topic="${CSS.escape(pending.title)}"]`);
    viewport.scrollTop = 0;
    if (topic) revealElement(viewport, topic);
  }, []);

  useLayoutEffect(() => {
    shownContentRef.current = { activeSection, isSearching };
    revealPendingTopic();
  }, [activeSection, isSearching, revealPendingTopic]);

  const navSections = useMemo(
    () => (isSearching && counts ? withMatchCounts(HELP_SECTIONS, counts) : HELP_SECTIONS),
    [isSearching, counts],
  );
  const hasNoMatches = isSearching && counts !== null && Object.keys(counts).length === 0;

  return (
    <ModalNavLayout
      sections={navSections}
      activeSection={isSearching ? null : activeSection}
      onSectionChange={openSection}
      sidebarHeader={<SearchField label="Search help" value={query} onChange={setQuery} inputRef={searchInputRef} />}
      contentClassName="px-6 pt-5 pb-4"
      contentInitialScrollTop={initialScrollTop}
      contentViewportRef={viewportRef}
      onContentInitialized={revealPendingTopic}
      onContentScrollTopChange={trackScrollTop}
    >
      <SettingLinkContext value={linkHost}>
        <div data-help-content>
          {hasNoMatches && (
            <div className="flex py-12">
              <NoMatches
                size="large"
                message={<NoMatchMessage noun="help topics" query={query} />}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            </div>
          )}
          {isSearching ? (
            <HelpSearchResults terms={terms} onCounts={setCounts} onOpenSection={openSection} onOpenTopic={openTopic} />
          ) : (
            <HelpSectionContent section={activeSection} />
          )}
        </div>
      </SettingLinkContext>
    </ModalNavLayout>
  );
};

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, ...bodyProps }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Help"
    className="max-w-4xl h-[min(80vh,760px)] flex flex-col"
    bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
  >
    <HelpModalBody {...bodyProps} />

    <div className="flex items-center justify-center gap-1.5 h-11 px-5 border-t border-(--divider) text-[12.5px] text-(--muted) shrink-0 select-none">
      Press <InlineKeyBadge keys={getEffectiveKeysArray("global.help")} /> to open anytime
    </div>
  </Modal>
);

// -- Exports ------------------------------------------------------------------

export { HelpModal };
