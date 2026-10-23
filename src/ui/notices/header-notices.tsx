import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { NoticeList } from "@/ui/notices/notice-list";
import { type NoticeKind, type NoticeKindId, noticeItemCount, orderedKinds } from "@/ui/notices/notice-model";
import { NoticeReviewModal } from "@/ui/notices/notice-review-modal";
import { NoticeActionButton, NoticeDismissButton } from "@/ui/notices/notice-row";
import { useFitsWidth } from "@/ui/notices/use-fits-width";
import { useNoticeUndo } from "@/ui/notices/use-notice-undo";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { IconBulbOff, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface HeaderNoticesProps {
  kinds: readonly (NoticeKind | null)[];
  noun?: string;
}

// -- Constants ----------------------------------------------------------------

const PILL =
  "flex items-center gap-1.5 h-9 pl-3 pr-1 rounded-xl bg-[color-mix(in_oklab,var(--color-composer-accent)_8%,var(--layer-1))] shadow-[inset_0_0_0_1px_var(--edge)] text-[13px] text-(--label) whitespace-nowrap select-none";
const PILL_CHROME_PX = 16;
const LABEL = "flex items-center gap-1.5 min-w-0 cursor-pointer hover:text-composer-text";

// -- Components ---------------------------------------------------------------

const KindIcon: React.FC<{ kind: NoticeKind }> = ({ kind }) => {
  const Icon = kind.icon;
  return (
    <Icon
      className={cn("size-4 shrink-0", kind.tone === "warn" ? "text-composer-warning" : "text-composer-accent-text")}
    />
  );
};

// The labels and Review only bubble their click up to the pill, which opens the list; actions stop it.
const KindLabel: React.FC<{ kind: NoticeKind }> = ({ kind }) => (
  <button type="button" className={LABEL}>
    <KindIcon kind={kind} />
    <span className="tabular-nums">
      {kind.rows.length === 1 && kind.singleSummary ? kind.singleSummary : kind.summary}
    </span>
  </button>
);

const FullPill: React.FC<{ kinds: readonly NoticeKind[]; onDismissAll: (kind: NoticeKind) => void }> = ({
  kinds,
  onDismissAll,
}) => {
  const [first, ...rest] = kinds;
  const dismissable = kinds.filter((kind) => kind.dismiss);
  const direct = dismissable.length === 1 && dismissable[0].rows.length === 1 ? dismissable[0].singleAction : undefined;

  return (
    <>
      <KindLabel kind={first} />
      {rest.length > 0 && <span className="text-composer-text-faint">・</span>}
      {rest.length === 1 && <KindLabel kind={rest[0]} />}
      {rest.length > 1 && (
        <button type="button" className={cn(LABEL, "text-(--muted)")}>
          +{rest.length} more
        </button>
      )}
      <span className="flex items-center gap-0.5 ml-1.5">
        {direct ? (
          <NoticeActionButton action={direct} variant="primary" />
        ) : (
          <Button size="sm" variant="primary">
            Review
          </Button>
        )}
        {kinds.length === 1 && first.dismiss && (
          <NoticeDismissButton
            label={first.rows.length === 1 ? "Dismiss suggestion" : "Dismiss all suggestions"}
            onClick={() => onDismissAll(first)}
          />
        )}
      </span>
    </>
  );
};

const CompactPill: React.FC<{ kinds: readonly NoticeKind[]; noun: string; open: boolean }> = ({
  kinds,
  noun,
  open,
}) => {
  const total = noticeItemCount(kinds);
  return (
    <button type="button" aria-label={`${total} ${noun}`} className={cn(LABEL, "pr-2")}>
      {kinds.map((kind) => (
        <KindIcon key={kind.id} kind={kind} />
      ))}
      <span className="tabular-nums">
        {total} {noun}
      </span>
      <IconChevronDown className={cn("size-3.5 opacity-60", open && "rotate-180")} />
    </button>
  );
};

const UndoPill: React.FC<{ label: string; onUndo: () => void }> = ({ label, onUndo }) => (
  <div className={PILL}>
    <IconCheck className="size-4 text-composer-text-muted" />
    <span className="text-composer-text-muted">Dismissed {label}</span>
    <Button size="sm" variant="ghost" onClick={onUndo}>
      Undo
    </Button>
  </div>
);

const HeaderNotices: React.FC<HeaderNoticesProps> = ({ kinds: kindInputs, noun = "suggestions" }) => {
  const allKinds = kindInputs.filter((kind): kind is NoticeKind => kind !== null);
  const kinds = orderedKinds(allKinds);
  const [open, setOpen] = useState(false);
  const [reviewKindId, setReviewKindId] = useState<NoticeKindId | null>(null);
  const notices = useNoticeUndo(allKinds);
  const fitKey = kinds.map((kind) => `${kind.id}:${kind.rows.length}`).join(",");
  const { wrapperRef, contentRef, fits } = useFitsWidth(fitKey, PILL_CHROME_PX);

  useEscapeLayer("panel", open, () => setOpen(false));
  if (open && kinds.length === 0 && !notices.pendingUndo) setOpen(false);
  const reviewKind = kinds.find((kind) => kind.id === reviewKindId) ?? null;
  if (reviewKindId && !reviewKind) setReviewKindId(null);

  if (kinds.length === 0 && !notices.pendingUndo) {
    if (notices.dismissedCount === 0) return null;
    return (
      <IconButton
        label={`Show ${pluralize(notices.dismissedCount, "dismissed suggestion")}`}
        icon={<IconBulbOff className="size-4" />}
        variant="ghost"
        onClick={notices.showDismissed}
        className="size-9 opacity-60 hover:opacity-100"
      />
    );
  }

  return (
    <div ref={wrapperRef} className="flex flex-1 w-full min-w-0 justify-end">
      {kinds.length === 0 && notices.pendingUndo ? (
        <UndoPill label={notices.pendingUndo.label} onUndo={notices.undo} />
      ) : (
        <Popover
          trigger={
            <div className={cn(PILL, !fits && "pr-0")}>
              <span ref={contentRef} className="flex items-center gap-1.5">
                {fits ? (
                  <FullPill kinds={kinds} onDismissAll={notices.dismissAll} />
                ) : (
                  <CompactPill kinds={kinds} noun={noun} open={open} />
                )}
              </span>
            </div>
          }
          open={open}
          onOpenChange={setOpen}
          placement="bottom-end"
          aria-label="Suggestions"
        >
          <NoticeList
            kinds={kinds}
            pendingUndo={notices.pendingUndo}
            dismissedCount={notices.dismissedCount}
            onDismissRow={notices.dismissRow}
            onDismissAll={notices.dismissAll}
            onUndo={notices.undo}
            onShowAll={(kind) => {
              setOpen(false);
              setReviewKindId(kind.id);
            }}
            onShowDismissed={notices.showDismissed}
          />
        </Popover>
      )}
      <NoticeReviewModal kind={reviewKind} onClose={() => setReviewKindId(null)} onDismiss={notices.dismissRow} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { HeaderNotices };
