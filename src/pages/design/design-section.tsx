import { type DesignSectionId, designSectionTitle } from "@/pages/design/design-sections";
import { PROSE } from "@/ui/typography";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface DesignSectionProps {
  id: DesignSectionId;
  note: string;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

const DesignSection: React.FC<DesignSectionProps> = ({ id, note, children }) => {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="relative scroll-mt-24 flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 select-none">
        <h2 id={headingId} className="text-xl font-semibold text-composer-text text-balance">
          {designSectionTitle(id)}
        </h2>
        <p className={cn(PROSE, "max-w-prose")}>{note}</p>
      </header>
      {children}
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { DesignSection };
