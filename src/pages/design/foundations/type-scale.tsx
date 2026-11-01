import { HEADING, PROSE } from "@/ui/typography";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";

// -- Interfaces ----------------------------------------------------------------

interface TypeSample {
  role: string;
  classes: string;
  sample: string;
}

// -- Constants -----------------------------------------------------------------

const SAMPLE_TIME_SECONDS = 83.417;

const TYPE_SAMPLES: readonly TypeSample[] = [
  {
    role: "Page title",
    classes: "text-3xl md:text-5xl font-semibold",
    sample: "Sync every word",
  },
  { role: "Section title", classes: "text-xl font-semibold", sample: "Shared timing" },
  { role: "Heading", classes: HEADING, sample: "Background vocals" },
  {
    role: "Prose",
    classes: PROSE,
    sample: "Tap along with the song and each word lands where you hear it. Undo takes back one tap at a time.",
  },
  { role: "Tab label", classes: "text-[13.5px] font-medium", sample: "Timeline" },
  { role: "Small", classes: "text-xs", sample: "Saved just now" },
  {
    role: "Mono",
    classes: "font-mono tabular-nums text-sm",
    sample: formatTime(SAMPLE_TIME_SECONDS),
  },
];

// -- Components ----------------------------------------------------------------

const TypeRow: React.FC<{ sample: TypeSample }> = ({ sample }) => (
  <li className="grid gap-2 py-5 border-b border-(--divider) last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6 md:items-baseline">
    <div className="flex flex-col gap-0.5 min-w-0 select-none">
      <span className="text-sm font-medium text-composer-text">{sample.role}</span>
      <span className="font-mono text-xs text-(--muted) break-words">{sample.classes}</span>
    </div>
    <p className={cn("min-w-0 select-text cursor-text text-composer-text max-w-prose", sample.classes)}>
      {sample.sample}
    </p>
  </li>
);

const TypeScale: React.FC = () => (
  <ul className="flex flex-col">
    {TYPE_SAMPLES.map((sample) => (
      <TypeRow key={sample.role} sample={sample} />
    ))}
  </ul>
);

// -- Exports -------------------------------------------------------------------

export { TypeScale };
