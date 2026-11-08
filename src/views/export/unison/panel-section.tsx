import { cn } from "@/utils/cn";
import { useId } from "react";

// -- Interfaces ----------------------------------------------------------------

interface PanelSectionProps {
  title: string;
  meta?: React.ReactNode;
  first?: boolean;
  children: React.ReactNode;
}

// -- Constants -----------------------------------------------------------------

const DIVIDED_SECTION_STYLES = "-mx-4 px-4 border-t border-(--divider)";

// -- Components ----------------------------------------------------------------

const PanelSection: React.FC<PanelSectionProps> = ({ title, meta, first, children }) => {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-3", first ? "pt-1 pb-4" : cn("py-4", DIVIDED_SECTION_STYLES))}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 id={headingId} className="text-[13px] font-semibold text-composer-text">
          {title}
        </h4>
        {meta}
      </div>
      {children}
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { DIVIDED_SECTION_STYLES, PanelSection };
