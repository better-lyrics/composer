import { createContext } from "react";
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

// -- Component -----------------------------------------------------------------

const HelpTopic: React.FC<HelpTopicProps> = ({ title, children, showTitle = true, className }) => (
  <div data-help-topic={title} className={cn("relative", className)}>
    {showTitle && <h4 className={HEADING}>{title}</h4>}
    {children}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { HelpSectionContext, HelpTopic };
