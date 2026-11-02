import { initialRevision } from "@/domain/unison/revision-history";
import { useRevisions } from "@/hooks/unison/useRevisions";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { Modal } from "@/ui/modal";
import { RevisionDetail } from "@/views/export/unison/revision-detail";
import { RevisionList, RevisionListSkeleton } from "@/views/export/unison/revision-list";
import { useRevisionActions } from "@/views/export/unison/use-revision-actions";
import { InlineError } from "@/views/unison/view-states";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lyric: UnisonLyric;
  keyId: string;
  canEdit: boolean;
  initialRevNo: number | null;
}

type HistoryBodyProps = Omit<HistoryModalProps, "isOpen" | "onClose">;

// -- Components ----------------------------------------------------------------

const HistoryBody: React.FC<HistoryBodyProps> = ({ lyric, keyId, canEdit, initialRevNo }) => {
  const query = useRevisions(lyric.id);
  const [selectedRevNo, setSelectedRevNo] = useState(initialRevNo);
  const [now] = useState(Date.now);
  const actions = useRevisionActions(lyric, keyId, setSelectedRevNo);

  if (query.error) return <InlineError error={query.error} onRetry={() => void query.refetch()} className="px-0" />;

  const revisions = query.data ?? [];
  const selected = initialRevision(revisions, selectedRevNo);
  return (
    <div className="grid grid-cols-[272px_minmax(0,1fr)] gap-5 h-[460px]">
      <div className="flex flex-col gap-3 min-h-0" aria-busy={query.isPending}>
        {selected ? (
          <RevisionList
            revisions={revisions}
            selectedId={selected.id}
            now={now}
            onSelect={(revision) => setSelectedRevNo(revision.revNo)}
          />
        ) : (
          query.isPending && <RevisionListSkeleton />
        )}
        {revisions.length === 1 && <p className="text-xs text-(--muted)">No other revisions yet.</p>}
      </div>
      {selected && (
        <RevisionDetail
          key={selected.id}
          lyric={lyric}
          revision={selected}
          revisions={revisions}
          canEdit={canEdit}
          now={now}
          actions={actions}
        />
      )}
    </div>
  );
};

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, ...body }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Revision history" className="max-w-[860px]">
    <HistoryBody {...body} />
  </Modal>
);

// -- Exports -------------------------------------------------------------------

export { HistoryModal };
