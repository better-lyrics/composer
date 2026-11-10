import { TokenLabel } from "@/pages/design/foundations/token-label";
import { useResolvedTokens } from "@/pages/design/foundations/use-resolved-tokens";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface ShapeSample {
  name: string;
  use: string;
  sample: string;
  token?: string;
  fixedValue?: string;
}

// -- Constants -----------------------------------------------------------------

const SHADOWS: readonly ShapeSample[] = [
  {
    name: "--float-shadow",
    use: "Menus, popovers and tooltips, through surface-floating.",
    sample: "rounded-xl bg-(--pop) shadow-(--float-shadow)",
  },
  {
    name: "--raised-edge",
    use: "Raised buttons, tab caps and the workspace card.",
    sample: "rounded-xl bg-(--cap) shadow-(--raised-edge)",
  },
  {
    name: "--well-edge",
    use: "Wells, trays and displays.",
    sample: "rounded-xl bg-(--well) shadow-(--well-edge)",
  },
];

const RADII: readonly ShapeSample[] = [
  {
    name: "--radius-card",
    use: "The workspace card.",
    sample: "rounded-(--radius-card)",
    token: "--radius-card",
  },
  { name: "rounded-[9px]", use: "Tabs and the tab cap.", sample: "rounded-[9px]", fixedValue: "9px" },
  { name: "rounded-lg", use: "Buttons, fields and tooltips.", sample: "rounded-lg", token: "--radius-lg" },
  {
    name: "rounded-md",
    use: "Status chips, setting links and small icon buttons.",
    sample: "rounded-md",
    token: "--radius-md",
  },
  {
    name: "rounded-full",
    use: "Slider tracks and progress bars.",
    sample: "rounded-full",
    fixedValue: "calc(infinity * 1px)",
  },
];

const RADIUS_TOKEN_NAMES = RADII.flatMap((sample) => (sample.token ? [sample.token] : []));

// -- Components ----------------------------------------------------------------

const ShapeRow: React.FC<{ sample: ShapeSample; value?: string; sampleBox: string }> = ({
  sample,
  value,
  sampleBox,
}) => (
  <li className="flex items-start gap-4 min-w-0">
    <span aria-hidden className={cn("shrink-0", sampleBox, sample.sample)} />
    <div className="flex flex-col gap-1 min-w-0">
      <TokenLabel name={sample.name} value={value} />
      <p className="text-xs text-(--label) select-none text-pretty">{sample.use}</p>
    </div>
  </li>
);

const ShapeGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <h3 className="text-[14.5px] font-semibold text-composer-text select-none">{title}</h3>
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-6 gap-y-5">{children}</ul>
  </div>
);

const Shape: React.FC = () => {
  const values = useResolvedTokens(RADIUS_TOKEN_NAMES);
  const displayValue = (sample: ShapeSample) => (sample.token ? values[sample.token] : sample.fixedValue);
  return (
    <div className="flex flex-col gap-8">
      <ShapeGroup title="Shadows">
        {SHADOWS.map((sample) => (
          <ShapeRow key={sample.name} sample={sample} sampleBox="size-16" />
        ))}
      </ShapeGroup>
      <ShapeGroup title="Radii">
        {RADII.map((sample) => (
          <ShapeRow
            key={sample.name}
            sample={sample}
            value={displayValue(sample)}
            sampleBox="size-16 bg-(--cap) shadow-(--raised-edge)"
          />
        ))}
      </ShapeGroup>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { Shape };
