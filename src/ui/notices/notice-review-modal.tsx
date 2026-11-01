import { Modal } from "@/ui/modal";
import type { NoticeKind, NoticeRow } from "@/ui/notices/notice-model";
import { NoticeActionButton, NoticeRowItem } from "@/ui/notices/notice-row";
import { Scroll } from "@/ui/scroll";

// -- Components ---------------------------------------------------------------

const NoticeReviewModal: React.FC<{
  kind: NoticeKind | null;
  onClose: () => void;
  onDismiss: (kind: NoticeKind, row: NoticeRow) => void;
}> = ({ kind, onClose, onDismiss }) => {
  if (!kind) return null;
  const LeadingIcon = kind.icon;

  return (
    <Modal isOpen onClose={onClose} title={kind.modalTitle} className="max-w-xl" bodyClassName="p-0">
      <div className="px-5 py-3 border-b border-(--divider) flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-composer-text-muted min-w-0">
          <LeadingIcon className="size-4 text-composer-text shrink-0 opacity-50" />
          <span className="truncate">{kind.summary}</span>
        </div>
        {kind.acceptAll && kind.rows.length > 1 && <NoticeActionButton action={kind.acceptAll} variant="primary" />}
      </div>
      <Scroll className="max-h-[60vh]">
        <ul className="divide-y divide-(--divider)">
          {kind.rows.map((row) => (
            <NoticeRowItem
              key={row.key}
              kind={kind}
              row={row}
              onDismiss={(dismissed) => onDismiss(kind, dismissed)}
              className="px-5 py-3"
            />
          ))}
        </ul>
      </Scroll>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { NoticeReviewModal };
