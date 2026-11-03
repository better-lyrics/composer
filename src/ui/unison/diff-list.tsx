import type { DiffLine, DiffLineKind } from "@/domain/unison/revision-changes";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface DiffListProps {
  lines: readonly DiffLine[];
  className?: string;
}

// -- Constants -----------------------------------------------------------------

const MARKS: Record<DiffLineKind, string> = { same: "", retimed: "~", added: "+", removed: "-", gap: "" };
const SPOKEN: Record<DiffLineKind, string> = {
  same: "Unchanged: ",
  retimed: "Retimed: ",
  added: "Added: ",
  removed: "Removed: ",
  gap: "",
};
const LINE_STYLES: Record<DiffLineKind, string> = {
  same: "text-(--muted)",
  retimed: "text-composer-text",
  added: "bg-composer-positive/10 text-composer-text",
  removed: "bg-composer-negative/10 text-(--muted) line-through decoration-composer-negative/60",
  gap: "font-sans text-(--muted) select-none",
};

// -- Component -----------------------------------------------------------------

const DiffList: React.FC<DiffListProps> = ({ lines, className }) => (
  <ul
    aria-label="Changes"
    className={cn(
      "flex flex-col overflow-auto overscroll-contain rounded-[10px] bg-(--well) py-1.5 shadow-[inset_0_0_0_1px_var(--edge)] font-mono text-xs leading-5",
      className,
    )}
  >
    {lines.map((line, index) => (
      // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- read-only diff derived per render; lines have no id and can repeat word for word
      <li key={`${line.kind}-${index}`} className={cn("flex gap-2 px-3 select-text", LINE_STYLES[line.kind])}>
        <span aria-hidden="true" className="w-3 shrink-0 text-(--muted)">
          {MARKS[line.kind]}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-pretty break-words">
            <span className="sr-only">{SPOKEN[line.kind]}</span>
            {line.text}
          </span>
          {line.detail && <span className="font-sans text-xs text-(--label)">{line.detail}</span>}
        </span>
      </li>
    ))}
  </ul>
);

// -- Exports -------------------------------------------------------------------

export { DiffList };
