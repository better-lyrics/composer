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

interface TabBox {
  left: number;
  width: number;
}

// -- Helpers -------------------------------------------------------------------

function measureTabs(nav: HTMLElement, boxes: Map<string, TabBox>): void {
  boxes.clear();
  for (const tab of nav.querySelectorAll<HTMLElement>("[data-tab]")) {
    if (tab.dataset.tab) boxes.set(tab.dataset.tab, { left: tab.offsetLeft, width: tab.offsetWidth });
  }
}

function placeCap(cap: HTMLElement, box: TabBox): void {
  cap.style.width = `${box.width}px`;
  cap.style.transform = `translateX(${box.left}px)`;
}

// -- Hooks ---------------------------------------------------------------------

// Tab boxes are measured when the strip or a tab resizes, so a tab switch writes the cap without reading layout.
function useSlidingCap(active: string, tabIds: string) {
  const navRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);
  const boxesRef = useRef(new Map<string, TabBox>());
  const placedRef = useRef<TabBox | null>(null);

  useLayoutEffect(() => {
    activeRef.current = active;
    const nav = navRef.current;
    const cap = capRef.current;
    if (!nav || !cap) return;
    if (!boxesRef.current.has(active)) measureTabs(nav, boxesRef.current);
    const box = boxesRef.current.get(active);
    if (!box) return;
    placeCap(cap, box);
    placedRef.current = box;
    cap.dataset.placed = "";
  }, [active]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const cap = capRef.current;
    if (!nav || !cap || tabIds === "") return;
    // Only a tab change glides; a tab that resizes in place (a status icon growing in) carries the cap with it.
    const follow = () => {
      measureTabs(nav, boxesRef.current);
      const box = boxesRef.current.get(activeRef.current);
      const placed = placedRef.current;
      if (!box || (placed && placed.left === box.left && placed.width === box.width)) return;
      delete cap.dataset.placed;
      placeCap(cap, box);
      placedRef.current = box;
      void cap.offsetWidth;
      cap.dataset.placed = "";
    };
    const observer = new ResizeObserver(follow);
    observer.observe(nav);
    for (const tab of nav.querySelectorAll("[data-tab]")) observer.observe(tab, { box: "border-box" });
    return () => observer.disconnect();
  }, [tabIds]);

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
  const { navRef, capRef } = useSlidingCap(active, tabs.map((tab) => tab.id).join(" "));

  return (
    <nav
      ref={navRef}
      {...navAttributes}
      className="relative flex p-(--tray-pad) rounded-[calc(9px+var(--tray-pad))] bg-(--well) shadow-(--well-edge) select-none"
    >
      <span
        ref={capRef}
        aria-hidden="true"
        className="absolute top-(--tray-pad) left-0 h-[calc(100%-2*var(--tray-pad))] w-0 rounded-[9px] bg-(--cap) shadow-(--raised-edge) data-placed:transition-[transform,width] data-placed:duration-150 data-placed:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
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
