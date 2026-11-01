import { DESIGN_GROUPS, DESIGN_SECTIONS, type DesignSectionId } from "@/pages/design/design-sections";
import { ThemePicker } from "@/pages/design/theme-picker";
import { Select } from "@/ui/select";
import { cn } from "@/utils/cn";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// -- Constants -----------------------------------------------------------------

const JUMP_OPTIONS = DESIGN_SECTIONS.map((section) => ({ value: section.id, label: section.title }));

// -- Hooks ---------------------------------------------------------------------

function useActiveSection(): DesignSectionId {
  const [active, setActive] = useState<DesignSectionId>(DESIGN_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        const section = DESIGN_SECTIONS.find((entry) => entry.id === visible?.target.id);
        if (section) setActive(section.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const section of DESIGN_SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

// -- Components ----------------------------------------------------------------

const DesignNav: React.FC = () => {
  const active = useActiveSection();
  const reducedMotion = useReducedMotion();
  const jumpTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

  return (
    <>
      <div className="lg:hidden sticky top-[65px] z-40 -mx-6 px-6 py-3 flex gap-2 bg-composer-bg/90 backdrop-blur-md border-b border-(--divider)">
        <Select aria-label="Jump to section" value={active} onChange={jumpTo} options={JUMP_OPTIONS} />
        <ThemePicker />
      </div>
      <nav
        aria-label="Design system sections"
        className="hidden lg:flex flex-col gap-6 sticky top-24 self-start select-none"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-(--muted)">Theme</span>
          <ThemePicker />
        </div>
        {DESIGN_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-(--muted) mb-1">{group}</span>
            {DESIGN_SECTIONS.filter((section) => section.group === group).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active === section.id ? "location" : undefined}
                className={cn(
                  "text-sm py-0.5 cursor-pointer transition-colors",
                  active === section.id
                    ? "text-composer-text font-medium"
                    : "text-composer-text-secondary hover:text-composer-text",
                )}
              >
                {section.title}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { DesignNav };
