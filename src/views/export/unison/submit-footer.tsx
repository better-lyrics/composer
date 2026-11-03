import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import { UnisonAvatar } from "@/ui/unison/unison-avatar";
import { cn } from "@/utils/cn";
import { DIVIDED_SECTION_STYLES } from "@/views/export/unison/panel-section";
import { IconAlertCircle, IconAlertTriangle, IconCloudUpload } from "@tabler/icons-react";
import { useId } from "react";

// -- Interfaces ----------------------------------------------------------------

interface SubmitIdentity {
  displayName: string;
  avatarUrl: string | null;
}

interface SubmitFooterProps {
  identity: SubmitIdentity;
  outcome: React.ReactNode;
  sessionEnded: boolean;
  failure: string | null;
  label: string;
  pending: boolean;
  disabled: boolean;
  blockedReasonId?: string;
  onSend: () => void;
}

// -- Components ----------------------------------------------------------------

const SessionNotice: React.FC = () => (
  <div
    role="alert"
    className="flex items-center gap-3 p-3 rounded-[10px] bg-composer-warning/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-warning)_28%,transparent)]"
  >
    <IconAlertTriangle aria-hidden="true" className="size-4 shrink-0 text-composer-warning" />
    <p className="flex-1 text-[13px] leading-[18px] text-composer-text text-pretty">
      Connection ended. Your project is safe.
    </p>
    <ConnectPopover
      placement="left-start"
      reason="Your connection ended. Connect again to submit."
      trigger={
        <Button size="sm" variant="secondary">
          Connect
        </Button>
      }
    />
  </div>
);

const FailureLine: React.FC<{ id: string; text: string }> = ({ id, text }) => (
  <p
    id={id}
    role="alert"
    className="flex gap-1.5 text-xs leading-[18px] text-composer-error-text text-pretty select-text cursor-text"
  >
    <IconAlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
    {text}
  </p>
);

const MetaRow: React.FC<{ identity: SubmitIdentity; outcome: React.ReactNode }> = ({ identity, outcome }) => (
  <div className="flex items-center justify-between gap-3 min-h-4 text-xs text-(--muted)">
    {outcome}
    <Tooltip content={`Posted publicly as ${identity.displayName}`}>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <UnisonAvatar avatarUrl={identity.avatarUrl} className="size-4" />
        <span className="sr-only">Posting publicly as </span>
        {identity.displayName}
      </span>
    </Tooltip>
  </div>
);

const SubmitFooter: React.FC<SubmitFooterProps> = ({
  identity,
  outcome,
  sessionEnded,
  failure,
  label,
  pending,
  disabled,
  blockedReasonId,
  onSend,
}) => {
  const failureId = useId();
  const describedBy = failure ? failureId : disabled ? blockedReasonId : undefined;
  return (
    <div className={cn("flex flex-col gap-2 pt-4", DIVIDED_SECTION_STYLES)}>
      {sessionEnded ? (
        <SessionNotice />
      ) : failure ? (
        <FailureLine id={failureId} text={failure} />
      ) : (
        <MetaRow identity={identity} outcome={outcome} />
      )}
      <Button
        size="lg"
        variant="primary"
        hasIcon
        disabled={disabled || pending || sessionEnded}
        aria-busy={pending}
        aria-describedby={describedBy}
        onClick={onSend}
        className="w-full"
      >
        <IconCloudUpload aria-hidden="true" className="size-4" />
        {pending ? "Sending…" : label}
      </Button>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SubmitFooter };
export type { SubmitIdentity };
