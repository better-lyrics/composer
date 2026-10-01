import { instanceIndicesOf } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import type { Bounds } from "@/domain/word/bounds";
import { useProjectStore } from "@/stores/project";
import { useEffectiveFocus, useEffectiveFocusGroup } from "@/views/timeline/effective-focus";
import { instanceSpan } from "@/views/timeline/group-focus";
import { useMemo } from "react";

// -- Interfaces ----------------------------------------------------------------

interface SeekBarFocusBandProps {
  duration: number;
}

interface BandProps {
  kind: "heard" | "other";
  span: Bounds;
  duration: number;
  color: string;
}

// -- Constants -----------------------------------------------------------------

const BAND_STRENGTH: Record<BandProps["kind"], number> = { heard: 45, other: 18 };

// -- Functions -----------------------------------------------------------------

function instanceSpans(lines: readonly LyricLine[], groupId: string): { instanceIdx: number; span: Bounds }[] {
  return instanceIndicesOf(lines, groupId).flatMap((instanceIdx) => {
    const span = instanceSpan(lines, groupId, instanceIdx);
    return span ? [{ instanceIdx, span }] : [];
  });
}

// -- Components ----------------------------------------------------------------

const Band: React.FC<BandProps> = ({ kind, span, duration, color }) => {
  const left = (Math.min(span.begin, duration) / duration) * 100;
  const width = (Math.min(span.end, duration) / duration) * 100 - left;
  return (
    <div
      data-seek-bar-focus-band={kind}
      aria-hidden="true"
      className="pointer-events-none absolute -inset-y-0.75 rounded-[3px]"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        background: `color-mix(in srgb, ${color} ${BAND_STRENGTH[kind]}%, transparent)`,
      }}
    />
  );
};

const SeekBarFocusBand: React.FC<SeekBarFocusBandProps> = ({ duration }) => {
  const focus = useEffectiveFocus();
  const group = useEffectiveFocusGroup();
  const lines = useProjectStore((s) => s.lines);
  const onTimeline = useProjectStore((s) => s.activeTab === "timeline");
  const spans = useMemo(() => (group ? instanceSpans(lines, group.id) : []), [lines, group]);
  if (!focus || !group || !onTimeline || duration <= 0) return null;

  return spans.map(({ instanceIdx, span }) => (
    <Band
      key={instanceIdx}
      kind={instanceIdx === focus.hearInstanceIdx ? "heard" : "other"}
      span={span}
      duration={duration}
      color={group.color}
    />
  ));
};

// -- Exports -------------------------------------------------------------------

export { SeekBarFocusBand };
