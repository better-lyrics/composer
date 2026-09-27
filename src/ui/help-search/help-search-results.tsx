import { useLayoutEffect, useRef } from "react";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { clearHelpMatches, filterHelpTopics, paintHelpMatches } from "@/ui/help-search/filter-help-topics";
import { HelpSearchContext, type OpenHelpTopic } from "@/ui/help-search/help-search-context";
import { HelpSectionContent } from "@/ui/help-sections";
import { SearchResultGroupHeader } from "@/ui/search-result-group-header";

// -- Interfaces ----------------------------------------------------------------

interface HelpSearchResultsProps {
  terms: readonly string[];
  onCounts: (counts: Record<string, number>) => void;
  onOpenSection: (section: string) => void;
  onOpenTopic: OpenHelpTopic;
}

// -- Component -----------------------------------------------------------------

const HelpSearchResults: React.FC<HelpSearchResultsProps> = ({ terms, onCounts, onOpenSection, onOpenTopic }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const termsKey = terms.join(" ");

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const activeTerms = termsKey.split(" ");
    onCounts(filterHelpTopics(root, activeTerms));
    paintHelpMatches(root, activeTerms);
  }, [termsKey, onCounts]);

  useLayoutEffect(() => clearHelpMatches, []);

  return (
    <HelpSearchContext value={onOpenTopic}>
      <div ref={rootRef} className="flex flex-col gap-2">
        {HELP_SECTIONS.map((section) => (
          <section
            key={section.id}
            aria-label={section.label}
            data-help-result-section={section.id}
            data-help-section-label={section.label}
          >
            <SearchResultGroupHeader
              icon={section.icon}
              label={section.label}
              onOpenSection={() => onOpenSection(section.id)}
            />
            <div data-help-result-body className="pt-1">
              <HelpSectionContent section={section.id} />
            </div>
          </section>
        ))}
      </div>
    </HelpSearchContext>
  );
};

// -- Exports -------------------------------------------------------------------

export { HelpSearchResults };
