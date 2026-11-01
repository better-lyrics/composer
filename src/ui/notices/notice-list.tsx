import { Button } from "@/ui/button";
import type { NoticeKind, NoticeRow } from "@/ui/notices/notice-model";
import { DismissedRow, NoticeActionButton, NoticeRowItem } from "@/ui/notices/notice-row";
import type { PendingUndo } from "@/ui/notices/use-notice-undo";
import { cn } from "@/utils/cn";
import { IconList } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface NoticeListProps {
  kinds: readonly NoticeKind[];
  pendingUndo: PendingUndo | null;
  dismissedCount: number;
  onDismissRow: (kind: NoticeKind, row: NoticeRow) => void;
  onDismissAll: (kind: NoticeKind) => void;
  onUndo: () => void;
  onShowAll: (kind: NoticeKind) => void;
  onShowDismissed: () => void;
}

// -- Constants ----------------------------------------------------------------

const ROWS_SHOWN = 3;

// -- Components ---------------------------------------------------------------

const NoticeSection: React.FC<
  { kind: NoticeKind } & Omit<NoticeListProps, "kinds" | "dismissedCount" | "onShowDismissed">
> = ({ kind, pendingUndo, onDismissRow, onDismissAll, onUndo, onShowAll }) => {
  const Icon = kind.icon;
  const shown = kind.rows
    .slice(0, ROWS_SHOWN)
    .map((row) => (
      <NoticeRowItem key={row.key} kind={kind} row={row} onDismiss={(dismissed) => onDismissRow(kind, dismissed)} />
    ));
  if (pendingUndo?.kindId === kind.id) {
    shown.splice(
      Math.min(pendingUndo.index, shown.length),
      0,
      <DismissedRow key="dismissed" label={pendingUndo.label} onUndo={onUndo} />,
    );
  }

  return (
    <section className="py-1.5">
      <div className="flex items-center gap-2 h-9 px-4">
        <Icon
          className={cn(
            "size-4 shrink-0",
            kind.tone === "warn" ? "text-composer-warning" : "text-composer-accent-text",
          )}
        />
        <h3 className="flex-1 min-w-0 text-[13px] font-semibold truncate">{kind.summary}</h3>
        {kind.acceptAll && kind.rows.length > 1 && <NoticeActionButton action={kind.acceptAll} />}
        {kind.dismiss && kind.rows.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onDismissAll(kind);
            }}
          >
            Dismiss all
          </Button>
        )}
      </div>
      <ul>{shown}</ul>
      {kind.rows.length > ROWS_SHOWN && (
        <Button size="sm" variant="ghost" hasIcon onClick={() => onShowAll(kind)} className="ml-2.5">
          <IconList className="size-3.5" />
          Show all {kind.rows.length} in the review list
        </Button>
      )}
    </section>
  );
};

const NoticeList: React.FC<NoticeListProps> = ({ kinds, dismissedCount, onShowDismissed, ...sectionProps }) => {
  const undoKindShown = kinds.some((kind) => kind.id === sectionProps.pendingUndo?.kindId);

  return (
    <div className="w-[440px] max-h-[min(560px,70vh)] overflow-y-auto overscroll-none divide-y divide-(--divider)">
      {sectionProps.pendingUndo && !undoKindShown && (
        <ul className="py-1.5">
          <DismissedRow label={sectionProps.pendingUndo.label} onUndo={sectionProps.onUndo} />
        </ul>
      )}
      {kinds.map((kind) => (
        <NoticeSection key={kind.id} kind={kind} {...sectionProps} />
      ))}
      {dismissedCount > 0 && (
        <div className="px-2.5 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onShowDismissed();
            }}
          >
            Show {dismissedCount} dismissed
          </Button>
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { NoticeList };
