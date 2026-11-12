import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useDelayedBusy } from "@/hooks/use-delayed-busy";
import type { BetterLyricsDetection } from "@/hooks/unison/useBetterLyricsDetection";
import { BETTER_LYRICS_EXTENSION_ID } from "@/lib/unison/extension-port";
import type { StoredUnisonSession } from "@/lib/unison/session";
import { SupersededSignInError, signInWithExtension } from "@/lib/unison/sign-in";
import { Button } from "@/ui/button";
import { BetterLyricsMark } from "@/ui/unison/better-lyrics-mark";
import { EXTENSION_FAILURE_MESSAGES, type ExtensionFailure, extensionFailureOf } from "@/ui/unison/extension-failure";
import { IdentityFileDrop } from "@/ui/unison/identity-file-drop";
import { cn } from "@/utils/cn";
import { OrDivider } from "@/views/import/import-layout";

// -- Types ---------------------------------------------------------------------

type PendingSignIn = "extension" | "file" | null;

interface ConnectPanelProps {
  detection: BetterLyricsDetection;
  reason?: string;
  initialFailure?: ExtensionFailure | null;
  onConnected: (session: StoredUnisonSession) => void;
}

// -- Constants -----------------------------------------------------------------

const DEFAULT_REASON = "Submit to Unison and track your lyrics.";
const BETTER_LYRICS_INSTALL_URL = `https://chromewebstore.google.com/detail/better-lyrics/${BETTER_LYRICS_EXTENSION_ID}`;
const HINT = "text-xs leading-[18px] text-(--muted) text-pretty";

// -- Components ----------------------------------------------------------------

const MissingExtensionHint: React.FC = () => (
  <p className={HINT}>
    Not in this browser. Works in Chrome and most Chromium browsers.{" "}
    <a
      href={BETTER_LYRICS_INSTALL_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Get it from the Chrome Web Store"
      className="text-composer-accent-text underline-offset-2 hover:underline cursor-pointer"
    >
      Get it
    </a>
  </p>
);

const ExtensionFailureHint: React.FC<{ failure: ExtensionFailure }> = ({ failure }) => (
  <p
    role="alert"
    className="flex gap-1.5 text-xs leading-[18px] text-composer-negative text-pretty select-text cursor-text"
  >
    <IconAlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
    {EXTENSION_FAILURE_MESSAGES[failure]}
  </p>
);

const ExtensionButton: React.FC<{ waiting: boolean; disabled: boolean; onClick: () => void }> = ({
  waiting,
  disabled,
  onClick,
}) => {
  const showSpinner = useDelayedBusy(waiting);
  return (
    <Button
      size="lg"
      variant="secondary"
      hasIcon
      disabled={disabled}
      onClick={onClick}
      className="w-full text-composer-text"
    >
      {showSpinner ? (
        <IconLoader2 aria-hidden="true" className="size-[18px] animate-spin motion-reduce:animate-none" />
      ) : (
        <BetterLyricsMark />
      )}
      Continue with Better Lyrics
    </Button>
  );
};

const ConnectPanel: React.FC<ConnectPanelProps> = ({
  detection,
  reason = DEFAULT_REASON,
  initialFailure = null,
  onConnected,
}) => {
  const [pending, setPending] = useState<PendingSignIn>(null);
  const [failure, setFailure] = useState<ExtensionFailure | null>(initialFailure);
  const { state, extensionId } = detection;
  const waiting = pending === "extension";
  const panelRef = useRef<HTMLDivElement>(null);

  // A pending sign-in disables the focused control, which would drop focus to the page and out of the popover.
  const startPending = (next: Exclude<PendingSignIn, null>) => {
    if (panelRef.current?.contains(document.activeElement)) panelRef.current.focus();
    setPending(next);
  };

  const connectWithExtension = async () => {
    if (!extensionId) return;
    setFailure(null);
    startPending("extension");
    try {
      onConnected(await signInWithExtension(extensionId));
    } catch (error) {
      if (!(error instanceof SupersededSignInError)) setFailure(extensionFailureOf(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <div ref={panelRef} tabIndex={-1} className="flex flex-col gap-4 w-[380px] max-w-full p-4 outline-none">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-composer-text text-balance">Connect Better Lyrics</h2>
        <p className="text-[13px] leading-5 text-(--label) text-pretty">{reason}</p>
      </div>
      <div className="flex flex-col gap-2">
        <ExtensionButton
          waiting={waiting}
          disabled={state !== "ready" || pending !== null}
          onClick={() => void connectWithExtension()}
        />
        {state === "missing" && <MissingExtensionHint />}
        <p aria-live="polite" className={cn(HINT, "empty:hidden")}>
          {waiting ? "Approve the request in the Better Lyrics window." : ""}
        </p>
        {failure && !waiting && <ExtensionFailureHint failure={failure} />}
      </div>
      <OrDivider />
      <IdentityFileDrop
        disabled={waiting}
        onPendingChange={(filePending) => (filePending ? startPending("file") : setPending(null))}
        onConnected={onConnected}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ConnectPanel };
