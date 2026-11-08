import type { Placement } from "@floating-ui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { cloneElement, useState } from "react";
import { detectBetterLyrics, useBetterLyricsDetection } from "@/hooks/unison/useBetterLyricsDetection";
import { signInWithExtension } from "@/lib/unison/sign-in";
import { Button } from "@/ui/button";
import type { ButtonSize, ButtonVariant } from "@/ui/button-class-name";
import { Popover } from "@/ui/popover";
import { ConnectPanel } from "@/ui/unison/connect-panel";
import { type ExtensionFailure, extensionFailureOf } from "@/ui/unison/extension-failure";
import { cn } from "@/utils/cn";
import { showConnectedToast } from "@/utils/unison-toast";

// -- Interfaces ----------------------------------------------------------------

interface ConnectPopoverProps {
  trigger: React.ReactElement;
  reason?: string;
  placement?: Placement;
}

interface TriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// -- Components ----------------------------------------------------------------

// The main part connects through Better Lyrics when it is installed, and opens the panel otherwise.
// The caret always opens the panel, which also signs in with an identity file, such as for another account.
const ConnectPopover: React.FC<ConnectPopoverProps> = ({ trigger, reason, placement = "bottom-end" }) => {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failure, setFailure] = useState<ExtensionFailure | null>(null);
  const [group, setGroup] = useState<HTMLDivElement | null>(null);
  const detection = useBetterLyricsDetection(armed);
  const arm = () => setArmed(true);
  const triggerProps = trigger.props as TriggerProps;
  const fullWidth = triggerProps.className?.includes("w-full") ?? false;

  const openPanel = (withFailure: ExtensionFailure | null) => {
    setFailure(withFailure);
    setOpen(true);
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const extensionId = await detectBetterLyrics(queryClient);
      if (!extensionId) {
        openPanel(null);
        return;
      }
      const session = await signInWithExtension(extensionId);
      showConnectedToast(session.displayName);
    } catch (error) {
      openPanel(extensionFailureOf(error));
    } finally {
      setConnecting(false);
    }
  };

  const main = cloneElement(trigger, {
    disabled: connecting || triggerProps.disabled,
    "aria-busy": connecting || undefined,
    onPointerEnter: arm,
    onFocus: arm,
    onClick: () => void connect(),
    className: cn(triggerProps.className, "rounded-r-none", fullWidth && "flex-1 w-auto min-w-0"),
  } as TriggerProps);

  return (
    <div ref={setGroup} className={cn("inline-flex gap-px", fullWidth && "flex w-full")}>
      {main}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) {
            arm();
            setFailure(null);
          }
          setOpen(next);
        }}
        placement={placement}
        hasPopup="dialog"
        aria-label="Connect Better Lyrics"
        positionAnchor={group}
        trigger={
          <Button
            variant={triggerProps.variant}
            size={triggerProps.size}
            aria-label="Other ways to connect"
            title="Other ways to connect"
            onPointerEnter={arm}
            className="rounded-l-none px-1.5"
          >
            <IconChevronDown aria-hidden="true" className="size-3.5" />
          </Button>
        }
      >
        {(close) => (
          <ConnectPanel
            detection={detection}
            reason={reason}
            initialFailure={failure}
            onConnected={(session) => {
              close();
              showConnectedToast(session.displayName);
            }}
          />
        )}
      </Popover>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ConnectPopover };
