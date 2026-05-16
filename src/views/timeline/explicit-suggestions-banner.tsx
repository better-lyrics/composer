import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { Scroll } from "@/ui/scroll";
import { type ExplicitSuggestion, findExplicitWords } from "@/utils/explicit-detection";
import { getExplicitSnippet } from "@/utils/explicit-snippet";
import { IconAlertTriangle, IconLink, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";

const INLINE_WORD_MAX = 32;
const MODAL_LINE_MAX = 80;

const ExplicitSuggestionsBanner: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const dismissed = useProjectStore((s) => s.dismissedExplicitSuggestions);
  const dismissExplicitSuggestion = useProjectStore((s) => s.dismissExplicitSuggestion);
  const toggleWordExplicit = useProjectStore((s) => s.toggleWordExplicit);
  const markWordsExplicit = useProjectStore((s) => s.markWordsExplicit);
  const [modalOpen, setModalOpen] = useState(false);

  const suggestions = useMemo(() => findExplicitWords(lines, groups), [lines, groups]);
  const visible = useMemo(() => {
    const dismissedSet = new Set(dismissed);
    return suggestions.filter((s) => !dismissedSet.has(s.fingerprint));
  }, [suggestions, dismissed]);

  if (visible.length === 0 && modalOpen) setModalOpen(false);

  if (visible.length === 0) return null;

  const acceptOne = (s: ExplicitSuggestion) => {
    toggleWordExplicit(s.lineId, s.field, s.wordIndices);
  };

  const dismissOne = (s: ExplicitSuggestion) => dismissExplicitSuggestion(s.fingerprint);

  const dismissAll = () => {
    for (const s of visible) dismissExplicitSuggestion(s.fingerprint);
  };

  const acceptAll = () => {
    markWordsExplicit(
      visible.flatMap((s) => s.wordIndices.map((wordIndex) => ({ lineId: s.lineId, field: s.field, wordIndex }))),
      true,
    );
  };

  return (
    <>
      {visible.length === 1 ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-composer-border bg-composer-warning/8 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <IconAlertTriangle className="size-4 shrink-0 text-composer-warning" />
            <span className="text-composer-text truncate">
              Possibly explicit word:{" "}
              <span className="text-composer-text-secondary">"{truncate(visible[0].word, INLINE_WORD_MAX)}"</span>
              {visible[0].linked ? <LinkedPill linked={visible[0].linked} /> : null}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="primary" hasIcon onClick={() => acceptOne(visible[0])}>
              <IconAlertTriangle className="size-3.5" />
              Mark explicit
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => dismissOne(visible[0])}
              className="size-7"
              aria-label="Dismiss suggestion"
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-composer-border bg-composer-warning/8 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <IconAlertTriangle className="size-4 shrink-0 text-composer-warning" />
            <span className="text-composer-text truncate">
              Found {visible.length} possibly explicit words across your lyrics
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
              Review {visible.length}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={dismissAll}
              className="size-7"
              aria-label="Dismiss all suggestions"
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </div>
      )}
      <ExplicitSuggestionsModal
        isOpen={modalOpen && visible.length > 0}
        onClose={() => setModalOpen(false)}
        suggestions={visible}
        onAccept={acceptOne}
        onDismiss={dismissOne}
        onAcceptAll={acceptAll}
      />
    </>
  );
};

interface ExplicitSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: ExplicitSuggestion[];
  onAccept: (s: ExplicitSuggestion) => void;
  onDismiss: (s: ExplicitSuggestion) => void;
  onAcceptAll: () => void;
}

const ExplicitSuggestionsModal: React.FC<ExplicitSuggestionsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onAccept,
  onDismiss,
  onAcceptAll,
}) => {
  const lines = useProjectStore((s) => s.lines);
  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Explicit-word suggestions" className="max-w-xl" bodyClassName="p-0">
      <div className="px-5 py-3 border-b border-composer-border flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-composer-text-muted min-w-0">
          <IconAlertTriangle className="size-4 text-composer-text shrink-0 opacity-50" />
          <span className="truncate">
            {suggestions.length} possibly explicit word{suggestions.length === 1 ? "" : "s"} detected
          </span>
        </div>
        {suggestions.length > 1 && (
          <Button size="sm" variant="primary" hasIcon onClick={onAcceptAll} className="h-6 pl-1.5 pr-2 text-[11px]">
            <IconAlertTriangle className="size-3" />
            Mark all
          </Button>
        )}
      </div>
      <Scroll className="max-h-[60vh]">
        <ul className="divide-y divide-composer-border">
          {suggestions.map((s) => {
            const line = lineMap.get(s.lineId);
            const source = (s.field === "words" ? line?.text : line?.backgroundText) ?? "";
            return (
              <li key={s.fingerprint} className="flex flex-col gap-2 px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm text-composer-text">
                      <span className="text-composer-explicit font-medium">"{s.word}"</span>
                      <span className="text-composer-text-muted"> · {s.field === "words" ? "main" : "background"}</span>
                      {s.linked ? <LinkedPill linked={s.linked} /> : null}
                    </span>
                    <span className="text-xs text-composer-text-muted truncate">
                      {formatLineLocation(s)} · <SnippetPreview source={source} wordIndices={s.wordIndices} />
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="primary" hasIcon onClick={() => onAccept(s)}>
                      <IconAlertTriangle className="size-3.5" />
                      Mark
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDismiss(s)}
                      className="size-7"
                      aria-label="Dismiss suggestion"
                    >
                      <IconX className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Scroll>
    </Modal>
  );
};

const LinkedPill: React.FC<{ linked: NonNullable<ExplicitSuggestion["linked"]> }> = ({ linked }) => (
  <span
    className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border align-middle"
    style={{
      backgroundColor: "color-mix(in srgb, var(--color-composer-accent) 18%, transparent)",
      borderColor: "color-mix(in srgb, var(--color-composer-accent) 32%, transparent)",
      color: "var(--color-composer-accent-text)",
    }}
  >
    <IconLink className="size-2.5" />
    {linked.groupLabel} × {linked.instanceCount}
  </span>
);

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

const SnippetPreview: React.FC<{ source: string; wordIndices: number[] }> = ({ source, wordIndices }) => {
  const trimmed = source.trim();
  if (trimmed.length === 0) return <span>(empty line)</span>;
  const snippet = getExplicitSnippet(source, wordIndices, MODAL_LINE_MAX);
  if (!snippet) return <span>{truncate(trimmed, MODAL_LINE_MAX)}</span>;
  return (
    <span>
      {snippet.leadingEllipsis ? "…" : ""}
      {snippet.before}
      <span className="text-composer-explicit/75 font-medium">{snippet.word}</span>
      {snippet.after}
      {snippet.trailingEllipsis ? "…" : ""}
    </span>
  );
};

const MAX_LINE_NUMBERS_SHOWN = 4;

function formatLineLocation(s: ExplicitSuggestion): string {
  if (!s.linked) return `line ${s.lineIndex + 1}`;
  const indices = s.linked.instances.map((i) => i.lineIndex + 1).sort((a, b) => a - b);
  if (indices.length <= MAX_LINE_NUMBERS_SHOWN) {
    return `lines ${indices.join(", ")}`;
  }
  const shown = indices.slice(0, MAX_LINE_NUMBERS_SHOWN).join(", ");
  return `lines ${shown} +${indices.length - MAX_LINE_NUMBERS_SHOWN} more`;
}

export { ExplicitSuggestionsBanner };
