import { type ReactElement, type ReactNode, cloneElement, useId, useLayoutEffect, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

type TriggerElement = ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;

interface OnDemandPopoverProps {
  hasPopup: "dialog" | "listbox";
  trigger: TriggerElement;
  /** Renders the real popover around the trigger it is given. */
  children: (trigger: TriggerElement) => ReactNode;
}

type OpeningGesture = { kind: "click" } | { kind: "key"; key: string };

// -- Constants ----------------------------------------------------------------

const LIST_OPENING_KEYS = new Set(["ArrowDown", "ArrowUp"]);

// -- Helpers ------------------------------------------------------------------

function replayGesture(trigger: HTMLElement, gesture: OpeningGesture) {
  trigger.focus({ preventScroll: true });
  if (gesture.kind === "click") trigger.click();
  else trigger.dispatchEvent(new KeyboardEvent("keydown", { key: gesture.key, bubbles: true, cancelable: true }));
}

// -- Components ---------------------------------------------------------------

// A plain trigger stands in until the first open, so a long list mounts no popover machinery for closed rows.
// The opening click or key is replayed on the real trigger, which then keeps focus return and aria state.
const OnDemandPopover: React.FC<OnDemandPopoverProps> = ({ hasPopup, trigger, children }) => {
  const triggerId = useId();
  const [openingGesture, setOpeningGesture] = useState<OpeningGesture | null>(null);

  useLayoutEffect(() => {
    if (!openingGesture) return;
    const realTrigger = document.getElementById(triggerId);
    if (realTrigger) replayGesture(realTrigger, openingGesture);
  }, [openingGesture, triggerId]);

  if (openingGesture) return children(cloneElement(trigger, { id: triggerId }));

  return cloneElement(trigger, {
    id: triggerId,
    "aria-haspopup": hasPopup,
    "aria-expanded": false,
    onClick: () => setOpeningGesture({ kind: "click" }),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (hasPopup !== "listbox" || !LIST_OPENING_KEYS.has(event.key)) return;
      event.preventDefault();
      setOpeningGesture({ kind: "key", key: event.key });
    },
  });
};

// -- Exports ------------------------------------------------------------------

export { OnDemandPopover };
