import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface SurfaceSample {
  name: string;
  use: string;
  surface: string;
}

// -- Constants -----------------------------------------------------------------

const SURFACE_SAMPLES: readonly SurfaceSample[] = [
  {
    name: "Well",
    use: "Sunk into the page. Behind tab strips, segmented controls, sliders, switches and checkboxes.",
    surface: "rounded-xl bg-(--well) shadow-(--well-edge)",
  },
  {
    name: "Raised",
    use: "Sits on top of the page. Secondary buttons use it.",
    surface: "rounded-xl [background:var(--raised-face)] shadow-(--raised-edge)",
  },
  {
    name: "Floating",
    use: "Hovers over everything. Menus, popovers and tooltips.",
    surface: "rounded-xl surface-floating",
  },
  {
    name: "Display",
    use: "A dark screen for live readouts. The time readout and level meters on the deck.",
    surface: "rounded-xl bg-(--display) shadow-(--well-edge)",
  },
  {
    name: "Card",
    use: "The main workspace frame around the editor and the projects library.",
    surface: "workspace-card",
  },
];

// -- Components ----------------------------------------------------------------

const SurfaceTile: React.FC<{ sample: SurfaceSample }> = ({ sample }) => (
  <li className={cn("flex flex-col justify-end gap-1 min-h-36 p-4 select-none", sample.surface)}>
    <h3 className="text-[14.5px] font-semibold text-composer-text">{sample.name}</h3>
    <p className="text-sm text-(--label) leading-normal text-pretty">{sample.use}</p>
  </li>
);

const Surfaces: React.FC = () => (
  <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
    {SURFACE_SAMPLES.map((sample) => (
      <SurfaceTile key={sample.name} sample={sample} />
    ))}
  </ul>
);

// -- Exports -------------------------------------------------------------------

export { Surfaces };
