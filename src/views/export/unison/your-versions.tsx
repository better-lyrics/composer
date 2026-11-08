import { UNISON_VARIANT_CAP } from "@/domain/unison/submit-checks";
import type { UnisonVariant } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { ScoreLabel } from "@/ui/unison/score-label";
import { unisonSyncLabel } from "@/ui/unison/sync-type-label";
import { formatRelativeTimeInline } from "@/utils/format-relative-time";
import { PanelSection } from "@/views/export/unison/panel-section";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface YourVersionsProps {
  versions: readonly UnisonVariant[];
  capReached: boolean;
  reasonId: string;
  onLink: (lyricId: number) => void;
}

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
  onLink: (lyricId: number) => void;
}

const VersionRow: React.FC<VersionRowProps> = ({ version, now, onLink }) => (
  <li className="flex items-center gap-3 h-10 pl-3 pr-1.5 rounded-[10px] bg-(--layer-1)">
    <span className="flex-1 min-w-0 truncate text-[13px] text-(--label)">{versionLabel(version, now)}</span>
    <ScoreLabel score={version.score} voteCount={version.voteCount} />
    <Button size="sm" variant="secondary" onClick={() => onLink(version.id)} className="shrink-0">
      Link
    </Button>
  </li>
);

const YourVersions: React.FC<YourVersionsProps> = ({ versions, capReached, reasonId, onLink }) => {
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
          {capReached
            ? "Limit reached. Link one of yours to update it instead."
            : "You already have a version of this song. Link it to compare before sending anything."}
        </p>
        <ul className="flex flex-col gap-2">
          {versions.map((version) => (
            <VersionRow key={version.id} version={version} now={now} onLink={onLink} />
          ))}
        </ul>
      </div>
    </PanelSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { YourVersions };
