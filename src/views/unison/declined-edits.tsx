import { IconAlertCircle } from "@tabler/icons-react";
import { useId, useState } from "react";
import type { ProjectTab } from "@/domain/project/tab";
import { unisonStatus } from "@/domain/unison/lyric-status";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { requestHistoryAt } from "@/views/export/unison/history-request";

// -- Types ---------------------------------------------------------------------

interface DeclinedEditsProps {
  items: readonly UnisonMineItem[];
  projectByLyric: ReadonlyMap<string, { id: string }>;
  onOpenProject: (projectId: string, tab?: ProjectTab) => void;
}

interface DeclinedEditProps {
  item: UnisonMineItem;
  projectId: string | undefined;
  onOpenProject: (projectId: string, tab?: ProjectTab) => void;
}

// -- Components ----------------------------------------------------------------

const DeclinedEdit: React.FC<DeclinedEditProps> = ({ item, projectId, onOpenProject }) => {
  const noteId = useId();
  const [noteShown, setNoteShown] = useState(false);
  const rejected = item.revision.lastRejected;
  const note = rejected?.reviewNote?.trim();
  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 min-h-11 pl-3.5 pr-1.5 text-[13px]">
        <IconAlertCircle aria-hidden="true" className="size-4 shrink-0 text-composer-negative" />
        <span className="flex-1 min-w-0 truncate">
          The council declined your edit to <span className="font-medium">{item.song}</span>
        </span>
        {note && (
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={noteShown}
            aria-controls={noteId}
            onClick={() => setNoteShown((shown) => !shown)}
          >
            {noteShown ? "Hide the note" : "Read the note"}
          </Button>
        )}
        {projectId && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (rejected) requestHistoryAt(item.id, rejected.revNo);
              onOpenProject(projectId, "export");
            }}
          >
            Open project
          </Button>
        )}
      </div>
      {note && noteShown && (
        <p id={noteId} className="pl-10 pr-4 pb-3 text-[13px] text-(--label) text-pretty select-text cursor-text">
          {note}
        </p>
      )}
    </li>
  );
};

const DeclinedEdits: React.FC<DeclinedEditsProps> = ({ items, projectByLyric, onOpenProject }) => {
  const declined = items.filter((item) => unisonStatus(item) === "declined");
  if (declined.length === 0) return null;
  return (
    <ul
      aria-label="Declined edits"
      className="flex flex-col py-0.5 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] select-none"
    >
      {declined.map((item) => (
        <DeclinedEdit
          key={item.id}
          item={item}
          projectId={projectByLyric.get(String(item.id))?.id}
          onOpenProject={onOpenProject}
        />
      ))}
    </ul>
  );
};

// -- Exports -------------------------------------------------------------------

export { DeclinedEdits };
