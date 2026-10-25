import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { type NoticeKind, hiddenByDismissal } from "@/ui/notices/notice-model";
import {
  replacedOwnTimingNote,
  showGroupActionToast,
  showKeptOwnTimingToast,
  showReplacedOwnTimingToast,
} from "@/utils/group-toast";
import { pluralize } from "@/utils/pluralize";
import { type RepeatingSection, findRepeatingStandaloneSections } from "@/views/grouping/repeating-sections";
import { IconBulb, IconLink } from "@tabler/icons-react";
import { useMemo } from "react";

const MODAL_LINE_MAX = 80;
const MODAL_LINE_LIMIT = 6;

function useGroupingNotice(enabled = true): NoticeKind | null {
  const lines = useProjectStore((s) => s.lines);
  const dismissed = useProjectStore((s) => s.dismissedSuggestions);

  const suggestions = useMemo(() => (enabled ? findRepeatingStandaloneSections(lines) : []), [enabled, lines]);
  const { visible, dismissedFingerprints } = useMemo(
    () => hiddenByDismissal(suggestions, dismissed),
    [suggestions, dismissed],
  );

  if (visible.length === 0 && dismissedFingerprints.length === 0) return null;

  return {
    id: "grouping",
    icon: IconBulb,
    tone: "accent",
    summary: pluralize(visible.length, "grouping suggestion"),
    singleAction:
      visible.length === 1 ? { label: "Group them", icon: IconLink, run: () => acceptOne(visible[0]) } : undefined,
    rows: visible.map((section) => ({
      key: suggestionKey(section),
      fingerprints: [section.fingerprint],
      title: `${section.starts.length} runs · ${pluralize(section.length, "line")} each`,
      detail: `At lines ${section.starts.map((start) => `${start + 1} to ${start + section.length}`).join(", ")}`,
      preview: <BlockPreview lines={section.previewLines} />,
      accept: { label: "Group", icon: IconLink, run: () => acceptOne(section) },
      dismissedLabel: `${section.starts.length} runs of ${pluralize(section.length, "line")}`,
    })),
    acceptAll: { label: "Group all", icon: IconLink, run: () => showReplacedOwnTimingToast(groupSections(visible)) },
    dismiss: dismissFingerprints,
    restore: (fingerprints) => useProjectStore.getState().restoreSuggestions(fingerprints),
    dismissedFingerprints,
    modalTitle: "Grouping suggestions",
  };
}

function dismissFingerprints(fingerprints: readonly string[]): void {
  const { dismissSuggestion } = useProjectStore.getState();
  for (const fingerprint of fingerprints) dismissSuggestion(fingerprint);
}

function groupSections(sections: readonly RepeatingSection[]): number {
  const { duration } = useAudioStore.getState();
  const { groupRepeatingSections } = useProjectStore.getState();
  const outcomes = sections.map((section) => groupRepeatingSections(section.starts, section.length, { duration }));
  showKeptOwnTimingToast(
    outcomes.flatMap((outcome) => outcome.keptOwnTiming),
    "edit",
  );
  return outcomes.reduce((sum, outcome) => sum + outcome.replaced.length, 0);
}

function acceptOne(section: RepeatingSection): void {
  const replaced = groupSections([section]);
  if (replaced > 0) showGroupActionToast(replacedOwnTimingNote(replaced));
}

const BlockPreview: React.FC<{ lines: string[] }> = ({ lines }) => {
  const display = collapseLines(lines, MODAL_LINE_LIMIT);
  return (
    <div className="rounded-md border border-composer-border bg-composer-bg-elevated/60 px-3 py-2 text-xs text-composer-text-secondary whitespace-pre-wrap break-words">
      {display.map((entry, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable order from collapseLines
        <div key={idx} className={entry.kind === "ellipsis" ? "text-composer-text-muted" : undefined}>
          {entry.kind === "line" ? truncate(entry.text.trim() || "(empty line)", MODAL_LINE_MAX) : "…"}
        </div>
      ))}
    </div>
  );
};

function suggestionKey(s: RepeatingSection): string {
  return `${s.starts.join(",")}:${s.length}`;
}

type CollapsedEntry = { kind: "line"; text: string } | { kind: "ellipsis" };

function collapseLines(lines: string[], limit: number): CollapsedEntry[] {
  if (lines.length <= limit) return lines.map((text) => ({ kind: "line", text }));
  const head = Math.ceil((limit - 1) / 2);
  const tail = Math.floor((limit - 1) / 2);
  const out: CollapsedEntry[] = [];
  for (let i = 0; i < head; i++) out.push({ kind: "line", text: lines[i] });
  out.push({ kind: "ellipsis" });
  for (let i = lines.length - tail; i < lines.length; i++) out.push({ kind: "line", text: lines[i] });
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

export { useGroupingNotice };
