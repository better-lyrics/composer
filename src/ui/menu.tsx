import { useLastPresent } from "@/hooks/useLastPresent";
import { unscaledReference, useFloatingEntrance } from "@/ui/floating-motion";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import {
  FloatingFocusManager,
  FloatingList,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
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
  // Null closes the menu; it stays mounted with the last anchor until its exit finishes.
  anchor: MenuAnchor | null;
  align?: "start" | "end";
  onClose: () => void;
  "aria-label": string;
  children: ReactNode;
  className?: string;
  instant?: boolean;
}

interface MenuItemProps {
  icon?: Icon;
  lead?: ReactNode;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  trail?: ReactNode;
  shortcut?: string[];
  className?: string;
}

interface MenuRadioItemProps {
  lead?: ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onSelect: () => void;
  hideLabel?: boolean;
}

interface MenuContextValue {
  activeIndex: number | null;
  getItemProps: ReturnType<typeof useInteractions>["getItemProps"];
  close: () => void;
}

// -- Constants ----------------------------------------------------------------

const MENU_SURFACE =
  "w-[236px] max-h-full p-1.5 rounded-xl surface-floating select-none outline-none overflow-y-auto overscroll-none";

const NAVIGATION_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "]);

const MenuContext = createContext<MenuContextValue | null>(null);

// -- Helpers ------------------------------------------------------------------

function pointReference(x: number, y: number, within: Element) {
  return {
    getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
    contextElement: within,
  };
}

// -- Components ---------------------------------------------------------------

const Menu: React.FC<MenuProps> = ({
  anchor,
  align = "end",
  onClose,
  "aria-label": ariaLabel,
  children,
  className,
  instant = false,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const shownAnchor = useLastPresent(anchor);
  const isPoint = shownAnchor?.kind === "point";
  const { refs, floatingStyles, context } = useFloating({
    open: anchor !== null,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: isPoint || align === "start" ? "bottom-start" : "bottom-end",
    middleware: [
      offset(isPoint ? 0 : 8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    elements: shownAnchor?.kind === "element" ? { reference: shownAnchor.element } : undefined,
  });
  const { isMounted, styles: entranceStyles } = useFloatingEntrance(context, instant);

  useLayoutEffect(() => {
    if (!shownAnchor) return;
    if (shownAnchor.kind === "point")
      refs.setPositionReference(pointReference(shownAnchor.x, shownAnchor.y, shownAnchor.within));
    else if (shownAnchor.element instanceof HTMLElement)
      refs.setPositionReference(unscaledReference(shownAnchor.element));
  }, [shownAnchor, refs]);
  const dismiss = useDismiss(context, {
    ancestorScroll: isPoint,
    outsidePress: ({ target }) =>
      !(shownAnchor?.kind === "element" && target instanceof Node && shownAnchor.element.contains(target)),
  });
  const role = useRole(context, { role: "menu" });
  const navigation = useListNavigation(context, { listRef, activeIndex, onNavigate: setActiveIndex, loop: true });
  const { getFloatingProps, getItemProps } = useInteractions([dismiss, role, navigation]);
  const menu = useMemo(() => ({ activeIndex, getItemProps, close: onClose }), [activeIndex, getItemProps, onClose]);

  if (!isMounted) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} initialFocus={0} returnFocus modal={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          aria-label={ariaLabel}
          {...getFloatingProps({
            // Keys the menu handles stop here, so window-level editor shortcuts never act on them as well.
            onKeyDown: (event) => {
              if (NAVIGATION_KEYS.has(event.key)) event.stopPropagation();
            },
          })}
          className="layer-floating flex outline-none"
        >
          {/* The entrance scales this inner surface: a scale on the positioned layer would also scale its translate. */}
          <div style={entranceStyles} className={cn(MENU_SURFACE, className)}>
            <MenuContext.Provider value={menu}>
              <FloatingList elementsRef={listRef}>{children}</FloatingList>
            </MenuContext.Provider>
          </div>
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

const MenuItem: React.FC<MenuItemProps> = ({
  icon: ItemIcon,
  lead,
  label,
  onSelect,
  tone = "default",
  trail,
  shortcut,
  className,
}) => {
  const end = trail ?? (shortcut && shortcut.length > 0 ? <InlineKeyBadge keys={shortcut} /> : undefined);
  const itemProps = useMenuItem(label, onSelect);
  return (
    <button
      type="button"
      role="menuitem"
      {...itemProps}
      className={cn(
        ITEM_STYLES,
        end !== undefined && "pr-1.5",
        tone === "danger"
          ? "text-composer-negative hover:bg-composer-negative/12 data-active:bg-composer-negative/12"
          : "text-(--label) hover:bg-(--layer-2) hover:text-composer-text data-active:bg-(--layer-2) data-active:text-composer-text",
        className,
      )}
    >
      {ItemIcon && (
        <ItemIcon aria-hidden="true" className={cn("size-4 shrink-0", tone === "default" && "opacity-70")} />
      )}
      {lead}
      <span className="truncate">{label}</span>
      {end && (
        <span
          aria-hidden="true"
          className={cn(
            "ms-auto ps-4 flex gap-[3px] [&>[data-inline-key-badge]]:ml-0",
            tone === "danger" ? "text-composer-negative opacity-80" : "text-(--muted)",
          )}
        >
          {end}
        </span>
      )}
    </button>
  );
};

const MenuRadioItem: React.FC<MenuRadioItemProps> = ({ lead, label, description, checked, onSelect, hideLabel }) => {
  const itemProps = useMenuItem(label, onSelect);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      {...itemProps}
      className={cn(
        ITEM_STYLES,
        "py-2 rounded-[9px] text-[13.5px] text-composer-text hover:bg-(--layer-2) data-active:bg-(--layer-2)",
      )}
    >
      {lead}
      <span className={cn("min-w-0", hideLabel && !description && "sr-only")}>
        {!hideLabel && <span className="block truncate">{label}</span>}
        {description && <span className="block text-xs text-(--muted)">{description}</span>}
      </span>
      <IconCheck
        aria-hidden="true"
        className={cn("ms-auto size-[18px] shrink-0 text-composer-accent-text", !checked && "invisible")}
      />
    </button>
  );
};

const MenuSeparator: React.FC = () => <hr className="h-px mx-1.5 my-[5px] border-0 bg-(--divider)" />;

const MenuLabel: React.FC<{ children: ReactNode }> = ({ children }) => (
  <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold text-(--muted)">{children}</p>
);

// -- Exports ------------------------------------------------------------------

export { Menu, MenuItem, MenuLabel, MenuRadioItem, MenuSeparator };
export type { MenuAnchor };
