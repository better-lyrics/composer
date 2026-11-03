import { useBetterLyricsDetection } from "@/hooks/unison/useBetterLyricsDetection";
import { Popover } from "@/ui/popover";
import { ConnectPanel } from "@/ui/unison/connect-panel";
import { showConnectedToast } from "@/utils/unison-toast";
import type { Placement } from "@floating-ui/react";
import { cloneElement, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface ConnectPopoverProps {
  trigger: React.ReactElement;
  reason?: string;
  placement?: Placement;
}

// -- Components ----------------------------------------------------------------

const ConnectPopover: React.FC<ConnectPopoverProps> = ({ trigger, reason, placement = "bottom-end" }) => {
  const [armed, setArmed] = useState(false);
  const detection = useBetterLyricsDetection(armed);
  const arm = () => setArmed(true);
  const triggerProps = trigger.props as React.HTMLAttributes<HTMLElement>;
  // Hover or focus on the trigger starts the probe, so the panel usually opens with the answer ready.
  const armingTrigger = cloneElement(trigger, {
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      arm();
      triggerProps.onPointerEnter?.(event);
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      arm();
      triggerProps.onFocus?.(event);
    },
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <Popover
      trigger={armingTrigger}
      placement={placement}
      hasPopup="dialog"
      aria-label="Connect Better Lyrics"
      onOpenChange={(open) => {
        if (open) arm();
      }}
    >
      {(close) => (
        <ConnectPanel
          detection={detection}
          reason={reason}
          onConnected={(session) => {
            close();
            showConnectedToast(session.displayName);
          }}
        />
      )}
    </Popover>
  );
};

// -- Exports -------------------------------------------------------------------

export { ConnectPopover };
