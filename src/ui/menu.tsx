import { cn } from "@/utils/cn";
import {
  FloatingFocusManager,
  FloatingList,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useListItem,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import type { Icon } from "@tabler/icons-react";
import { type ReactNode, createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

type MenuAnchor = { kind: "element"; element: Element } | { kind: "point"; x: number; y: number; within: Element };

interface MenuProps {
  anchor: MenuAnchor;
  onClose: () => void;
  "aria-label": string;
  children: ReactNode;
}

interface MenuItemProps {
  icon: Icon;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  trail?: ReactNode;
}

interface MenuContextValue {
  activeIndex: number | null;
  getItemProps: ReturnType<typeof useInteractions>["getItemProps"];
  close: () => void;
}

// -- Constants ----------------------------------------------------------------

const MENU_SURFACE = "layer-floating w-[236px] p-1 rounded-xl bg-composer-bg select-none outline-none shadow-pop";

const MenuContext = createContext<MenuContextValue | null>(null);

// -- Helpers ------------------------------------------------------------------

function pointReference(x: number, y: number, within: Element) {
  return {
    getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
    contextElement: within,
  };
}

// -- Components ---------------------------------------------------------------

const Menu: React.FC<MenuProps> = ({ anchor, onClose, "aria-label": ariaLabel, children }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const isPoint = anchor.kind === "point";
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: isPoint ? "bottom-start" : "bottom-end",
    middleware: [offset(isPoint ? 0 : 4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: isPoint ? undefined : { reference: anchor.element },
  });

  useLayoutEffect(() => {
    if (anchor.kind === "point") refs.setPositionReference(pointReference(anchor.x, anchor.y, anchor.within));
  }, [anchor, refs]);
  const dismiss = useDismiss(context, {
    ancestorScroll: anchor.kind === "point",
    outsidePress: ({ target }) =>
      !(anchor.kind === "element" && target instanceof Node && anchor.element.contains(target)),
  });
  const role = useRole(context, { role: "menu" });
  const navigation = useListNavigation(context, { listRef, activeIndex, onNavigate: setActiveIndex, loop: true });
  const { getFloatingProps, getItemProps } = useInteractions([dismiss, role, navigation]);
  const menu = useMemo(() => ({ activeIndex, getItemProps, close: onClose }), [activeIndex, getItemProps, onClose]);

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} initialFocus={0} returnFocus modal={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          aria-label={ariaLabel}
          {...getFloatingProps()}
          className={MENU_SURFACE}
        >
          <MenuContext.Provider value={menu}>
            <FloatingList elementsRef={listRef}>{children}</FloatingList>
          </MenuContext.Provider>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

const MenuItem: React.FC<MenuItemProps> = ({ icon: ItemIcon, label, onSelect, tone = "default", trail }) => {
  const menu = useContext(MenuContext);
  const { ref, index } = useListItem({ label });
  if (!menu) throw new Error("MenuItem must be rendered inside a Menu");
  const isActive = menu.activeIndex === index;

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={isActive ? 0 : -1}
      data-active={isActive || undefined}
      {...menu.getItemProps({
        onClick: () => {
          menu.close();
          onSelect();
        },
      })}
      className={cn(
        "flex items-center gap-2.5 w-full min-h-8 px-2 py-1.5 rounded-lg text-sm text-left cursor-pointer outline-none",
        "hover:bg-composer-button data-active:bg-composer-button",
        tone === "danger" ? "text-composer-negative" : "text-composer-text",
      )}
    >
      <ItemIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          tone === "danger" ? "text-composer-negative" : "text-composer-text opacity-50",
        )}
      />
      <span className="truncate">{label}</span>
      {trail && <span className="ms-auto flex gap-[3px]">{trail}</span>}
    </button>
  );
};

const MenuSeparator: React.FC = () => <hr className="h-px my-1 border-0 bg-composer-border" />;

// -- Exports ------------------------------------------------------------------

export { Menu, MenuItem, MenuSeparator };
export type { MenuAnchor };
