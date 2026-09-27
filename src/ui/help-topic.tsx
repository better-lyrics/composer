import { createContext, useContext } from "react";
import { HelpSearchContext } from "@/ui/help-search/help-search-context";
import { HEADING } from "@/ui/typography";
import { cn } from "@/utils/cn";

// -- Context -------------------------------------------------------------------

const HelpSectionContext = createContext<string | null>(null);

// -- Interfaces ----------------------------------------------------------------

interface HelpTopicProps {
  title: string;
  children: React.ReactNode;
  showTitle?: boolean;
  className?: string;
}

// -- Components ----------------------------------------------------------------

const OpenTopicButton: React.FC<{ section: string; title: string }> = ({ section, title }) => {
  const openTopic = useContext(HelpSearchContext);
  if (!openTopic) return null;
  return (
    <button
      type="button"
      data-search-ignore
      aria-label={`Open ${title}`}
      onClick={() => openTopic(section, title)}
      className="absolute top-0 right-0 z-10 px-1.5 py-0.5 rounded-md text-xs text-composer-text-faint bg-composer-bg-dark opacity-0 group-hover/topic:opacity-100 focus-visible:opacity-100 hover:text-composer-accent-text cursor-pointer select-none transition-[opacity,color]"
    >
      Open
    </button>
  );
};

const HelpTopic: React.FC<HelpTopicProps> = ({ title, children, showTitle = true, className }) => {
  const section = useContext(HelpSectionContext);
  return (
    <div data-help-topic={title} className={cn("group/topic relative", className)}>
      {showTitle && <h4 className={HEADING}>{title}</h4>}
      {children}
      {section && <OpenTopicButton section={section} title={title} />}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { HelpSectionContext, HelpTopic };
