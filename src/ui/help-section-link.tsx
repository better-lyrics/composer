import { useUIStore } from "@/stores/ui";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { PROSE_LINK } from "@/ui/typography";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface HelpSectionLinkProps {
  section: string;
  children?: React.ReactNode;
  className?: string;
}

// -- Components ----------------------------------------------------------------

const HelpSectionLink: React.FC<HelpSectionLinkProps> = ({ section, children, className }) => (
  <button
    type="button"
    onClick={() => useUIStore.getState().openHelp(section)}
    className={cn(PROSE_LINK, "cursor-pointer", className)}
  >
    {children ?? HELP_SECTIONS.find((entry) => entry.id === section)?.label}
  </button>
);

// -- Exports -------------------------------------------------------------------

export { HelpSectionLink };
