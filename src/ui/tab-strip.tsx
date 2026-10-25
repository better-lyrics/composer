import { cn } from "@/utils/cn";
import { useLayoutEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------

type DataAttributes = Partial<Record<`data-${string}`, string>>;

interface TabStripTab<T extends string> {
  id: T;
  label: string;
}

interface TabStripProps<T extends string> {
  tabs: readonly TabStripTab<T>[];
  active: T;
  onSelect: (id: T) => void;
  renderTab?: (tab: TabStripTab<T>, index: number, isActive: boolean) => React.ReactNode;
  tabAttributes?: (tab: TabStripTab<T>) => React.ButtonHTMLAttributes<HTMLButtonElement> & DataAttributes;
  navAttributes?: React.HTMLAttributes<HTMLElement> & DataAttributes;
  children?: React.ReactNode;
}

// -- Hooks ---------------------------------------------------------------------

function useSlidingCap(active: string) {
  const navRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const cap = capRef.current;
    if (!nav || !cap) return;
    const place = () => {
      const tab = nav.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!tab) return;
      cap.style.width = `${tab.offsetWidth}px`;
      cap.style.transform = `translateX(${tab.offsetLeft}px)`;
    };
    place();
    cap.dataset.placed = "";
    // Only a tab change glides; a tab that resizes in place (a status icon growing in) carries the cap with it.
    let observedOnce = false;
    const follow = () => {
      if (!observedOnce) {
        observedOnce = true;
        return;
      }
      delete cap.dataset.placed;
      place();
      void cap.offsetWidth;
      cap.dataset.placed = "";
    };
    const observer = new ResizeObserver(follow);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);

  return { navRef, capRef };
}

// -- Components ----------------------------------------------------------------

function TabStrip<T extends string>({
  tabs,
  active,
  onSelect,
  renderTab,
  tabAttributes,
  navAttributes,
  children,
}: TabStripProps<T>) {
  const { navRef, capRef } = useSlidingCap(active);

  return (
    <nav
      ref={navRef}
      {...navAttributes}
      className="relative flex p-(--tray-pad) rounded-[calc(9px+var(--tray-pad))] bg-(--well) shadow-(--well-edge) select-none"
    >
      <span
        ref={capRef}
        aria-hidden="true"
        className="absolute top-(--tray-pad) left-0 h-[calc(100%-2*var(--tray-pad))] w-0 rounded-[9px] bg-(--cap) shadow-(--raised-edge) data-placed:transition-[transform,width] data-placed:duration-400 data-placed:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      />
      {tabs.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            {...tabAttributes?.(tab)}
            data-tab={tab.id}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "relative flex items-center h-8 px-3 rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors",
              isActive ? "text-composer-text" : "text-[var(--muted)] hover:text-[var(--label)]",
            )}
          >
            {renderTab ? renderTab(tab, index, isActive) : tab.label}
          </button>
        );
      })}
      {children}
    </nav>
  );
}

// -- Exports -------------------------------------------------------------------

export { TabStrip };
export type { TabStripTab };
