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
import { type Icon, IconCheck } from "@tabler/icons-react";
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

interface MenuRadioItemProps {
  lead: ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onSelect: () => void;
}

interface MenuContextValue {
  activeIndex: number | null;
  getItemProps: ReturnType<typeof useInteractions>["getItemProps"];
  close: () => void;
}

// -- Constants ----------------------------------------------------------------

const MENU_SURFACE = "layer-floating w-[236px] p-1.5 rounded-xl surface-floating select-none outline-none";

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

const ITEM_STYLES =
  "flex items-center gap-2.5 w-full min-h-8 px-2.5 py-1.5 rounded-lg text-[13px] text-left cursor-pointer outline-none transition-colors";

function useMenuItem(label: string, onSelect: () => void) {
  const menu = useContext(MenuContext);
  const { ref, index } = useListItem({ label });
  if (!menu) throw new Error("Menu items must be rendered inside a Menu");
  const isActive = menu.activeIndex === index;
  return {
    ref,
    tabIndex: isActive ? 0 : -1,
    "data-active": isActive || undefined,
    ...menu.getItemProps({
      onClick: () => {
        menu.close();
        onSelect();
      },
    }),
  };
}

const MenuItem: React.FC<MenuItemProps> = ({ icon: ItemIcon, label, onSelect, tone = "default", trail }) => {
  const itemProps = useMenuItem(label, onSelect);
  return (
    <button
      type="button"
      role="menuitem"
      {...itemProps}
      className={cn(
        ITEM_STYLES,
        tone === "danger"
          ? "text-composer-negative hover:bg-composer-negative/12 data-active:bg-composer-negative/12"
          : "text-(--label) hover:bg-(--layer-2) hover:text-composer-text data-active:bg-(--layer-2) data-active:text-composer-text",
      )}
    >
      <ItemIcon aria-hidden="true" className={cn("size-4 shrink-0", tone === "default" && "opacity-70")} />
      <span className="truncate">{label}</span>
      {trail && <span className="ms-auto flex gap-[3px] text-(--muted)">{trail}</span>}
    </button>
  );
};

const MenuRadioItem: React.FC<MenuRadioItemProps> = ({ lead, label, description, checked, onSelect }) => {
  const itemProps = useMenuItem(label, onSelect);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      {...itemProps}
      className={cn(
        ITEM_STYLES,
        "py-2 text-[13.5px] text-composer-text hover:bg-(--layer-2) data-active:bg-(--layer-2)",
      )}
    >
      {lead}
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {description && <span className="block text-xs text-(--muted)">{description}</span>}
      </span>
      <IconCheck
        aria-hidden="true"
        className={cn("ms-auto size-4 shrink-0 text-composer-accent-text", !checked && "invisible")}
      />
    </button>
  );
};

const MenuSeparator: React.FC = () => <hr className="h-px mx-1.5 my-1 border-0 bg-(--divider)" />;

// -- Exports ------------------------------------------------------------------

export { Menu, MenuItem, MenuRadioItem, MenuSeparator };
export type { MenuAnchor };
