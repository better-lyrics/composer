import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { findRepeatingStandaloneSections } from "@/views/timeline/repeating-sections";
import { IconLink, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";

const PREVIEW_MAX = 36;

const GroupingSuggestionsBanner: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const groupRepeatingSections = useProjectStore((s) => s.groupRepeatingSections);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const suggestions = useMemo(() => findRepeatingStandaloneSections(lines), [lines]);
  const visible = suggestions.find((s) => !dismissedKeys.has(suggestionKey(s.starts, s.length)));

  if (!visible) return null;

  const key = suggestionKey(visible.starts, visible.length);
  const previewText = truncate(visible.preview.trim() || "(empty line)", PREVIEW_MAX);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-composer-border bg-composer-accent/8 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <IconLink className="w-4 h-4 shrink-0 text-composer-accent" />
        <span className="text-composer-text truncate">
          {visible.starts.length} runs of <span className="text-composer-text-secondary">"{previewText}"</span> look
          like a group
          {visible.length > 1 ? ` (${visible.length} lines each)` : ""}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="primary"
          hasIcon
          onClick={() => groupRepeatingSections(visible.starts, visible.length)}
        >
          <IconLink className="w-3.5 h-3.5" />
          Group them
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDismissedKeys((prev) => new Set(prev).add(key))}
          className="h-7 w-7"
          aria-label="Dismiss suggestion"
        >
          <IconX className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

function suggestionKey(starts: number[], length: number): string {
  return `${starts.join(",")}:${length}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

export { GroupingSuggestionsBanner };
