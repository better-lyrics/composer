import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import type { NoticeAction, NoticeKind, NoticeRow } from "@/ui/notices/notice-model";
import { cn } from "@/utils/cn";
import { IconX } from "@tabler/icons-react";

// -- Components ---------------------------------------------------------------

const NoticeActionButton: React.FC<{ action: NoticeAction; variant?: "primary" | "secondary"; className?: string }> = ({
  action,
  variant = "secondary",
  className,
}) => {
  const Icon = action.icon;
  return (
    <Button
      size="sm"
      variant={variant}
      hasIcon={Icon !== undefined}
      onClick={(event) => {
        event.stopPropagation();
        action.run();
      }}
      className={className}
    >
      {Icon && <Icon className="size-3.5" />}
      {action.label}
    </Button>
  );
};

const NoticeDismissButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <IconButton
    label={label}
    icon={<IconX className="size-4" />}
    variant="ghost"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className="size-7"
  />
);

const NoticeRowItem: React.FC<{
  kind: NoticeKind;
  row: NoticeRow;
  onDismiss: (row: NoticeRow) => void;
  className?: string;
}> = ({ kind, row, onDismiss, className }) => (
  <li className={cn("flex flex-col gap-2 px-4 py-2.5", className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[13px] text-composer-text truncate">{row.title}</span>
        {row.detail && <span className="text-xs text-composer-text-muted">{row.detail}</span>}
      </div>
      {(row.accept || kind.dismiss) && (
        <div className="flex items-center gap-1 shrink-0">
          {row.accept && <NoticeActionButton action={row.accept} />}
          {kind.dismiss && <NoticeDismissButton label="Dismiss suggestion" onClick={() => onDismiss(row)} />}
        </div>
      )}
    </div>
    {row.preview}
  </li>
);

const DismissedRow: React.FC<{ label: string; onUndo: () => void }> = ({ label, onUndo }) => (
  <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] text-composer-text-muted">
    <span className="truncate">Dismissed {label}</span>
    <Button
      size="sm"
      variant="ghost"
      onClick={(event) => {
        event.stopPropagation();
        onUndo();
      }}
    >
      Undo
    </Button>
  </li>
);

// -- Exports ------------------------------------------------------------------

export { DismissedRow, NoticeActionButton, NoticeDismissButton, NoticeRowItem };
