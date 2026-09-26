import { Fragment } from "react";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface LyricSampleLine {
  agent?: string;
  main?: string;
  background?: string;
  rest?: string;
  spaced?: boolean;
}

interface LyricSampleProps {
  lines: LyricSampleLine[];
}

interface SyllableSampleProps {
  parts: string[];
  caption: string;
}

type TimingCell =
  | { kind: "word"; label: string; highlighted?: boolean; wide?: boolean }
  | { kind: "gap"; width: "sm" | "lg" }
  | { kind: "group"; cells: TimingCell[] };

interface TimingSampleProps {
  caption: string;
  cells: TimingCell[];
}

// -- Constants -----------------------------------------------------------------

const SILENCE_HATCH =
  "bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--color-composer-text)_5%,transparent)_0_3px,transparent_3px_6px)]";

// -- Components ----------------------------------------------------------------

const MonoLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn("font-mono text-[10px] text-composer-text-faint", className)}>{children}</p>
);

const LyricSample: React.FC<LyricSampleProps> = ({ lines }) => (
  <div className="flex flex-col gap-2 text-sm tracking-[-0.01em] select-text">
    {lines.map((line, index) => (
      <div key={`${index}-${line.main ?? line.rest ?? line.agent ?? ""}`} className={cn(line.spaced && "mt-2")}>
        {line.agent ? <MonoLabel className="mb-0.5">{line.agent}</MonoLabel> : null}
        {line.main ? <p className="font-medium text-composer-text">{line.main}</p> : null}
        {line.background ? <p className="mt-0.5 text-xs text-composer-text-muted">{line.background}</p> : null}
        {line.rest ? <p className="text-xs text-composer-text-faint italic">{line.rest}</p> : null}
      </div>
    ))}
  </div>
);

const SyllableSample: React.FC<SyllableSampleProps> = ({ parts, caption }) => (
  <div className="flex flex-col gap-3 select-text">
    <p className="font-mono text-sm text-composer-text">
      {parts.map((part, index) => (
        <Fragment key={`${index}-${part}`}>
          {index > 0 ? <span className="px-px text-composer-accent-text">|</span> : null}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
    <MonoLabel>{caption}</MonoLabel>
  </div>
);

const WordBlock: React.FC<{ label: string; highlighted?: boolean; wide?: boolean }> = ({
  label,
  highlighted,
  wide,
}) => (
  <span
    className={cn(
      "grid h-4.5 place-items-center rounded-sm font-mono text-[10px]",
      wide ? "px-5" : "px-1.5",
      highlighted ? "bg-composer-accent text-composer-on-accent" : "bg-composer-wave text-composer-text",
    )}
  >
    {label}
  </span>
);

const GapCell: React.FC<{ width: "sm" | "lg" }> = ({ width }) => (
  <span className={cn("h-4.5 rounded-sm", SILENCE_HATCH, width === "sm" ? "w-2" : "w-8")} />
);

const ParagraphBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-composer-border-hover p-0.5">
    {children}
  </span>
);

const TimingCells: React.FC<{ cells: TimingCell[] }> = ({ cells }) => (
  <>
    {cells.map((cell, index) => {
      const key = `${index}-${cell.kind}`;
      if (cell.kind === "gap") return <GapCell key={key} width={cell.width} />;
      if (cell.kind === "group")
        return (
          <ParagraphBox key={key}>
            <TimingCells cells={cell.cells} />
          </ParagraphBox>
        );
      return <WordBlock key={key} label={cell.label} highlighted={cell.highlighted} wide={cell.wide} />;
    })}
  </>
);

const TimingSample: React.FC<TimingSampleProps> = ({ caption, cells }) => (
  <div className="flex flex-col gap-1 select-text">
    <div className="flex h-6.5 items-center gap-0.5">
      <TimingCells cells={cells} />
    </div>
    <MonoLabel>{caption}</MonoLabel>
  </div>
);

// -- Exports -------------------------------------------------------------------

export { LyricSample, SyllableSample, TimingSample };
