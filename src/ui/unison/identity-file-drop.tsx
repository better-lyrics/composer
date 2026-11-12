import { IconAlertCircle, IconFileText } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import { useDelayedBusy } from "@/hooks/use-delayed-busy";
import { IdentityFileError } from "@/domain/unison/identity-file";
import { UnisonError } from "@/lib/unison/client";
import type { StoredUnisonSession } from "@/lib/unison/session";
import { SupersededSignInError, signInWithIdentityFile } from "@/lib/unison/sign-in";
import { DelayedSpinner } from "@/ui/delayed-spinner";
import { DropTileContent } from "@/ui/drop-tile";
import { DROP_TILE_STYLES } from "@/ui/drop-tile-styles";
import { cn } from "@/utils/cn";
import { isFileDrag } from "@/utils/file-drag";

// -- Interfaces ----------------------------------------------------------------

interface IdentityFileDropProps {
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  onConnected: (session: StoredUnisonSession) => void;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonConnect]";
const IDENTITY_FILE_ACCEPT = ".json,application/json";
const UNREACHABLE_MESSAGE = "Couldn't reach Unison. Check your connection and try again.";
const REJECTED_MESSAGE = "Unison couldn't sign you in with this file. Try again in a moment.";

// -- Helpers -------------------------------------------------------------------

function identityFileErrorMessage(error: unknown): string {
  if (error instanceof IdentityFileError) return error.message;
  console.error(LOG_PREFIX, "Identity file sign-in failed", error);
  return error instanceof UnisonError && error.code === "NETWORK" ? UNREACHABLE_MESSAGE : REJECTED_MESSAGE;
}

// -- Components ----------------------------------------------------------------

const IdentityFileDrop: React.FC<IdentityFileDropProps> = ({ disabled, onPendingChange, onConnected }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const showSpinner = useDelayedBusy(reading);

  const connectWith = async (file: File) => {
    setError(null);
    setReading(true);
    onPendingChange(true);
    try {
      onConnected(await signInWithIdentityFile(file));
    } catch (signInError) {
      if (!(signInError instanceof SupersededSignInError)) setError(identityFileErrorMessage(signInError));
    } finally {
      setReading(false);
      onPendingChange(false);
    }
  };

  const acceptDrag = (event: React.DragEvent) => {
    if (disabled || reading || !isFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const leaveDrag = (event: React.DragEvent) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragOver(false);
  };

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled && !reading) void connectWith(file);
  };

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void connectWith(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || reading}
        aria-busy={reading || undefined}
        aria-describedby={error ? errorId : undefined}
        onClick={() => inputRef.current?.click()}
        onDragEnter={acceptDrag}
        onDragOver={acceptDrag}
        onDragLeave={leaveDrag}
        onDrop={drop}
        className={cn(
          DROP_TILE_STYLES,
          "cursor-pointer disabled:cursor-not-allowed",
          disabled && "opacity-60",
          isDragOver && "border-composer-accent bg-composer-accent/10",
        )}
      >
        <DropTileContent
          icon={
            <DelayedSpinner
              busy={reading}
              className="size-[18px]"
              idle={<IconFileText aria-hidden="true" className="size-[18px]" />}
            />
          }
          title="Use your identity file"
          detail={showSpinner ? "Connecting to Unison" : "From Better Lyrics settings, never stored"}
        />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={IDENTITY_FILE_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={pick}
        className="hidden"
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex gap-1.5 text-xs leading-[18px] text-composer-negative text-pretty select-text cursor-text"
        >
          <IconAlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { IdentityFileDrop };
