import { formatScore } from "@/domain/unison/lyric-status";
import type { UnisonVariant } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { unisonSyncLabel } from "@/ui/unison/sync-type-label";
import { formatRelativeTimeInline } from "@/utils/format-relative-time";
import { PanelSection } from "@/views/export/unison/panel-section";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface YourVersionsProps {
  versions: readonly UnisonVariant[];
  capReached: boolean;
  reasonId: string;
  onUpdate: (lyricId: number) => void;
}

// -- Constants -----------------------------------------------------------------

// Unison's `submission.maxVariantsPerUserPerVideo`.
const UNISON_VARIANT_CAP = 3;

// -- Helpers -------------------------------------------------------------------

function versionLabel(version: UnisonVariant, now: number): string {
  const sync = unisonSyncLabel(version.syncType);
  return version.createdAt === undefined
    ? sync
    : `${sync} ・ ${formatRelativeTimeInline(version.createdAt * 1000, now)}`;
}

// -- Components ----------------------------------------------------------------

interface VersionRowProps {
  version: UnisonVariant;
  now: number;
  actionLabel: string;
  onUpdate: (lyricId: number) => void;
}

const VersionRow: React.FC<VersionRowProps> = ({ version, now, actionLabel, onUpdate }) => (
  <li className="flex items-center gap-3 h-10 pl-3 pr-1.5 rounded-[10px] bg-(--layer-1)">
    <span className="flex-1 min-w-0 truncate text-[13px] text-(--label)">{versionLabel(version, now)}</span>
    <span className="text-[13px] font-medium tabular-nums">
      {formatScore(version.score)}
      <span className="sr-only"> score</span>
    </span>
    <Button size="sm" variant="secondary" onClick={() => onUpdate(version.id)} className="shrink-0">
      {actionLabel}
    </Button>
  </li>
);

const YourVersions: React.FC<YourVersionsProps> = ({ versions, capReached, reasonId, onUpdate }) => {
  const [now] = useState(Date.now);
  return (
    <PanelSection
      title="Your versions"
      meta={
        capReached ? (
          <span className="font-mono text-xs text-(--muted) tabular-nums">
            {versions.length} / {UNISON_VARIANT_CAP}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <p id={reasonId} className="text-[13px] leading-5 text-composer-text text-pretty">
          {capReached ? "Limit reached. Update one instead." : "You already have a version of this song."}
        </p>
        <ul className="flex flex-col gap-2">
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              now={now}
              actionLabel={capReached ? "Update" : "Update it"}
              onUpdate={onUpdate}
            />
          ))}
        </ul>
      </div>
    </PanelSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { UNISON_VARIANT_CAP, YourVersions };
