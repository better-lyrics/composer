import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { Tooltip } from "@/ui/tooltip";
import { isMac } from "@/utils/platform";
import { isInPopover, isTypingTarget } from "@/utils/typing-target";
import { isKeyboardContextMenu } from "@/views/timeline/keyboard-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconDots } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const KEYBOARD_MENU_KEYS = isMac ? undefined : ["Shift", "F10"];

// -- Functions -----------------------------------------------------------------

function openSelectionMenu(anchorElement: Element): void {
  const { selectedWords, setContextMenu } = useTimelineStore.getState();
  const word = selectedWords[0];
  if (!word) return;
  const { left, bottom } = anchorElement.getBoundingClientRect();
  setContextMenu({ x: left, y: bottom, anchorElement, target: { kind: "word", ...word } });
}

function ownsKeyboardContextMenu(event: MouseEvent): boolean {
  if (event.defaultPrevented || !isKeyboardContextMenu(event)) return false;
  return !isTypingTarget(event.target) && !isInPopover(event.target) && !isAnyModalOpen();
}

// -- Components ----------------------------------------------------------------

const SelectionMenuButton: React.FC = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isOpen = useTimelineStore((s) => s.contextMenu?.anchorElement !== undefined);
  const showHints = useSettingsStore((s) => s.showShortcutHints);

  useEffect(() => {
    const openFromKeyboard = (event: MouseEvent) => {
      if (!buttonRef.current || !ownsKeyboardContextMenu(event)) return;
      event.preventDefault();
      openSelectionMenu(buttonRef.current);
    };
    window.addEventListener("contextmenu", openFromKeyboard);
    return () => window.removeEventListener("contextmenu", openFromKeyboard);
  }, []);

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isOpen) useTimelineStore.getState().clearContextMenu();
    else openSelectionMenu(event.currentTarget);
  };

  return (
    <Tooltip content={<ShortcutTip label="More actions" keys={KEYBOARD_MENU_KEYS} />} disabled={isOpen}>
      <Button
        ref={buttonRef}
        variant="secondary"
        size="sm"
        hasIcon
        onClick={toggleMenu}
        className="[&>[data-inline-key-badge]]:ml-0"
        {...menuTriggerProps(isOpen)}
      >
        <IconDots className="size-3.5" />
        <span>More</span>
        {showHints && KEYBOARD_MENU_KEYS && <InlineKeyBadge keys={KEYBOARD_MENU_KEYS} />}
      </Button>
    </Tooltip>
  );
};

// -- Exports -------------------------------------------------------------------

export { SelectionMenuButton };
