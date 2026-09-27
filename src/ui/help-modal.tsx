import { useTypeToSearch } from "@/hooks/useTypeToSearch";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { HelpSearchResults } from "@/ui/help-search/help-search-results";
import { HelpSectionContent } from "@/ui/help-sections";
import { withMatchCounts } from "@/ui/nav-match-counts";
import { Modal } from "@/ui/modal";
import { ModalNavLayout } from "@/ui/modal-nav-layout";
import { NoMatches } from "@/ui/no-matches";
import { revealElement } from "@/ui/reveal-element";
import { SearchField } from "@/ui/search-field";
import { SettingLinkContext, type SettingLinkHost } from "@/ui/setting-link-context";
import { KeyBadge } from "@/ui/shortcut-reference";
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
  const [counts, setCounts] = useState<Record<string, number>>({});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingTopicRef = useRef<PendingTopic | null>(null);
  const terms = useMemo(() => splitSearchTerms(query), [query]);
  const isSearching = terms.length > 0;

  useTypeToSearch(searchInputRef, query, setQuery);

  const linkHost = useMemo<SettingLinkHost>(
    () => ({
      returnPoint: () => ({
        section: activeSection,
        scrollTop: viewportRef.current?.scrollTop ?? 0,
        ...(query.trim() ? { query } : {}),
      }),
    }),
    [activeSection, query],
  );

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

  const lastQueryRef = useRef(query);
  useLayoutEffect(() => {
    if (lastQueryRef.current === query) return;
    lastQueryRef.current = query;
    if (query.trim()) viewportRef.current?.scrollTo({ top: 0 });
  }, [query]);

  useLayoutEffect(() => {
    const pending = pendingTopicRef.current;
    const viewport = viewportRef.current;
    if (!pending || isSearching || !viewport || pending.section !== activeSection) return;
    pendingTopicRef.current = null;
    const topic = viewport.querySelector<HTMLElement>(`[data-help-topic="${CSS.escape(pending.title)}"]`);
    viewport.scrollTop = 0;
    if (topic) revealElement(viewport, topic);
  }, [activeSection, isSearching]);

  const navSections = useMemo(
    () => (isSearching ? withMatchCounts(HELP_SECTIONS, counts) : HELP_SECTIONS),
    [isSearching, counts],
  );
  const hasNoMatches = isSearching && Object.keys(counts).length === 0;

  return (
    <ModalNavLayout
      sections={navSections}
      activeSection={isSearching ? null : activeSection}
      onSectionChange={openSection}
      sidebarHeader={<SearchField label="Search help" value={query} onChange={setQuery} inputRef={searchInputRef} />}
      sidebarClassName="w-48"
      contentClassName="p-6"
      contentInitialScrollTop={initialScrollTop}
      contentViewportRef={viewportRef}
    >
      <SettingLinkContext value={linkHost}>
        <div data-help-content>
          {hasNoMatches && (
            <div className="flex py-12">
              <NoMatches
                size="large"
                message={`No help topics match "${query.trim()}"`}
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
    className="max-w-4xl h-[80%] flex flex-col"
    bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
  >
    <HelpModalBody {...bodyProps} />

    <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none flex items-center justify-center gap-1.5">
      Press{" "}
      {getEffectiveKeysArray("global.help").map((key) => (
        <KeyBadge key={key} keyName={key} />
      ))}{" "}
      to open anytime
    </div>
  </Modal>
);

// -- Exports ------------------------------------------------------------------

export { HelpModal };
