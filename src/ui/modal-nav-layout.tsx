import { Scroll } from "@/ui/scroll";
import { cn } from "@/utils/cn";
import type { MutableRefObject } from "react";

// -- Types ---------------------------------------------------------------------

interface ModalNavSection<T extends string = string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trailing?: React.ReactNode;
  dimmed?: boolean;
}

interface ModalNavLayoutProps<T extends string> {
  sections: readonly ModalNavSection<T>[];
  activeSection: T | null;
  onSectionChange: (id: T) => void;
  children: React.ReactNode;
  contentClassName?: string;
  sidebarHeader?: React.ReactNode;
  contentInitialScrollTop?: number;
  contentViewportRef?: MutableRefObject<HTMLDivElement | null>;
  onContentInitialized?: (viewport: HTMLDivElement) => void;
  onContentScrollTopChange?: (scrollTop: number) => void;
}

// -- Component -----------------------------------------------------------------

function ModalNavLayout<T extends string>({
  sections,
  activeSection,
  onSectionChange,
  children,
  contentClassName,
  sidebarHeader,
  contentInitialScrollTop,
  contentViewportRef,
  onContentInitialized,
  onContentScrollTopChange,
}: ModalNavLayoutProps<T>) {
  return (
    <div className="flex flex-1 min-h-0">
      <Scroll className="w-[196px] shrink-0 border-r border-(--divider) select-none">
        <div className="flex flex-col gap-0.5 px-2.5 py-3">
          {sidebarHeader}
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                aria-current={isActive ? "page" : undefined}
                data-dimmed={section.dimmed ? "" : undefined}
                className={cn(
                  "flex items-center gap-2.5 w-full h-8.5 px-2.5 rounded-[9px] text-[13.5px] font-medium text-left cursor-pointer transition-[color,background-color,opacity]",
                  isActive
                    ? "bg-(--cap) shadow-(--raised-edge) text-composer-text [&>svg]:text-composer-accent-text"
                    : "text-(--muted) hover:bg-(--layer-1) hover:text-(--label)",
                  section.dimmed && !isActive && "opacity-40",
                )}
              >
                <Icon size={17} className="shrink-0" />
                {section.label}
                {section.trailing && <span className="ml-auto">{section.trailing}</span>}
              </button>
            );
          })}
        </div>
      </Scroll>

      <Scroll
        className={cn("flex-1", contentClassName)}
        initialScrollTop={contentInitialScrollTop}
        viewportRef={contentViewportRef}
        onInitialized={onContentInitialized}
        onScrollTopChange={onContentScrollTopChange}
      >
        {children}
      </Scroll>
    </div>
  );
}

// -- Exports -------------------------------------------------------------------

export { ModalNavLayout };
export type { ModalNavSection };
