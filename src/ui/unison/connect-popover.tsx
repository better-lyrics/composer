import type { Placement } from "@floating-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { cloneElement, useState } from "react";
import { detectBetterLyrics, useBetterLyricsDetection } from "@/hooks/unison/useBetterLyricsDetection";
import { SupersededSignInError, signInWithExtension } from "@/lib/unison/sign-in";
import type { ButtonSize, ButtonVariant } from "@/ui/button-class-name";
import { SplitLatch } from "@/ui/split-latch";
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
  const detection = useBetterLyricsDetection(armed);
  const arm = () => setArmed(true);
  const triggerProps = trigger.props as TriggerProps;
  const fullWidth = triggerProps.className?.includes("w-full") ?? false;
  const raised = triggerProps.variant !== "ghost";

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
      if (!(error instanceof SupersededSignInError)) openPanel(extensionFailureOf(error));
    } finally {
      setConnecting(false);
    }
  };

  const main = cloneElement(trigger, {
    variant: "ghost",
    disabled: connecting || triggerProps.disabled,
    "aria-busy": connecting || undefined,
    onPointerEnter: arm,
    onFocus: arm,
    onClick: () => void connect(),
    className: cn(
      triggerProps.className,
      "pr-1.5",
      raised && "text-(--label) hover:text-composer-text",
      fullWidth && "w-full",
    ),
  } as TriggerProps);

  return (
    <SplitLatch
      variant={raised ? "raised" : "action"}
      menuLabel="Other ways to connect"
      placement={placement}
      className={cn(fullWidth && "w-full [&>:first-child]:flex-1")}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          arm();
          setFailure(null);
        }
        setOpen(next);
      }}
      latch={<div>{main}</div>}
    >
      <ConnectPanel
        detection={detection}
        reason={reason}
        initialFailure={failure}
        onConnected={(session) => {
          setOpen(false);
          showConnectedToast(session.displayName);
        }}
      />
    </SplitLatch>
  );
};

// -- Exports -------------------------------------------------------------------

export { ConnectPopover };
