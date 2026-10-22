import { useProjectStore } from "@/stores/project";
import { type ExplicitSuggestion, findExplicitWords } from "@/utils/explicit-detection";
import { getExplicitSnippet } from "@/utils/explicit-snippet";
import { type NoticeKind, hiddenByDismissal } from "@/ui/notices/notice-model";
import { pluralize } from "@/utils/pluralize";
import { IconAlertTriangle, IconLink } from "@tabler/icons-react";
import { useMemo } from "react";

const INLINE_WORD_MAX = 32;
const MODAL_LINE_MAX = 80;
const MAX_LINE_NUMBERS_SHOWN = 4;

function useExplicitNotice(): NoticeKind | null {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const dismissed = useProjectStore((s) => s.dismissedExplicitSuggestions);

  const suggestions = useMemo(() => findExplicitWords(lines, groups), [lines, groups]);
  const { visible, dismissedFingerprints } = useMemo(
    () => hiddenByDismissal(suggestions, dismissed),
    [suggestions, dismissed],
  );
  const lineMap = useMemo(() => new Map(lines.map((line) => [line.id, line])), [lines]);

  if (visible.length === 0 && dismissedFingerprints.length === 0) return null;
  const only = visible.length === 1 ? visible[0] : undefined;

  return {
    id: "explicit",
    icon: IconAlertTriangle,
    tone: "warn",
    summary: pluralize(visible.length, "possibly explicit word"),
    singleSummary: only && `Possibly explicit: "${truncate(only.word, INLINE_WORD_MAX)}"`,
    singleAction: only && { label: "Mark explicit", icon: IconAlertTriangle, run: () => markOne(only) },
    rows: visible.map((suggestion) => {
      const line = lineMap.get(suggestion.lineId);
      const source = (suggestion.field === "words" ? line?.text : line?.backgroundText) ?? "";
      return {
        key: suggestion.fingerprint,
        fingerprints: [suggestion.fingerprint],
        title: (
          <>
            <span className="text-composer-explicit font-medium">"{suggestion.word}"</span>
            <span className="text-composer-text-muted"> · {suggestion.field === "words" ? "main" : "background"}</span>
            {suggestion.linked ? <LinkedPill linked={suggestion.linked} /> : null}
          </>
        ),
        detail: (
          <>
            {formatLineLocation(suggestion)} · <SnippetPreview source={source} wordIndices={suggestion.wordIndices} />
          </>
        ),
        accept: { label: "Mark", icon: IconAlertTriangle, run: () => markOne(suggestion) },
        dismissedLabel: `"${suggestion.word}" on ${formatLineLocation(suggestion)}`,
      };
    }),
    acceptAll: { label: "Mark all", icon: IconAlertTriangle, run: () => markAll(visible) },
    dismiss: dismissFingerprints,
    restore: (fingerprints) => useProjectStore.getState().restoreExplicitSuggestions(fingerprints),
    dismissedFingerprints,
    modalTitle: "Explicit-word suggestions",
  };
}

function markOne(suggestion: ExplicitSuggestion): void {
  useProjectStore.getState().toggleWordExplicit(suggestion.lineId, suggestion.field, suggestion.wordIndices);
}

function markAll(visible: readonly ExplicitSuggestion[]): void {
  useProjectStore.getState().markWordsExplicit(
    visible.flatMap((s) => s.wordIndices.map((wordIndex) => ({ lineId: s.lineId, field: s.field, wordIndex }))),
    true,
  );
}

function dismissFingerprints(fingerprints: readonly string[]): void {
  const { dismissExplicitSuggestion } = useProjectStore.getState();
  for (const fingerprint of fingerprints) dismissExplicitSuggestion(fingerprint);
}

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

function formatLineLocation(s: ExplicitSuggestion): string {
  if (!s.linked) return `line ${s.lineIndex + 1}`;
  const indices = s.linked.instances.map((i) => i.lineIndex + 1).sort((a, b) => a - b);
  if (indices.length <= MAX_LINE_NUMBERS_SHOWN) {
    return `lines ${indices.join(", ")}`;
  }
  const shown = indices.slice(0, MAX_LINE_NUMBERS_SHOWN).join(", ");
  return `lines ${shown} +${indices.length - MAX_LINE_NUMBERS_SHOWN} more`;
}

export { useExplicitNotice };
