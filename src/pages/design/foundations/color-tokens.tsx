import { colorProbe, displayColor } from "@/pages/design/foundations/display-color";
import { TokenLabel } from "@/pages/design/foundations/token-label";
import { useResolvedTokens } from "@/pages/design/foundations/use-resolved-tokens";
import { cn } from "@/utils/cn";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface ColorToken {
  name: string;
  swatch: string;
}

interface ColorGroup {
  title: string;
  tokens: readonly ColorToken[];
}

// -- Constants -----------------------------------------------------------------

const COLOR_GROUPS: readonly ColorGroup[] = [
  {
    title: "Surfaces",
    tokens: [
      { name: "--color-composer-bg", swatch: "bg-(--color-composer-bg)" },
      { name: "--color-composer-bg-dark", swatch: "bg-(--color-composer-bg-dark)" },
      { name: "--color-composer-bg-elevated", swatch: "bg-(--color-composer-bg-elevated)" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "--color-composer-text", swatch: "bg-(--color-composer-text)" },
      { name: "--color-composer-text-secondary", swatch: "bg-(--color-composer-text-secondary)" },
      { name: "--color-composer-text-muted", swatch: "bg-(--color-composer-text-muted)" },
      { name: "--color-composer-text-tertiary", swatch: "bg-(--color-composer-text-tertiary)" },
      { name: "--color-composer-text-faint", swatch: "bg-(--color-composer-text-faint)" },
    ],
  },
  {
    title: "Ink",
    tokens: [
      { name: "--muted", swatch: "bg-(--muted)" },
      { name: "--label", swatch: "bg-(--label)" },
      { name: "--divider", swatch: "bg-(--divider)" },
      { name: "--edge", swatch: "bg-(--edge)" },
      { name: "--cap", swatch: "bg-(--cap)" },
    ],
  },
  {
    title: "Accent",
    tokens: [
      { name: "--color-composer-accent", swatch: "bg-(--color-composer-accent)" },
      { name: "--color-composer-accent-dark", swatch: "bg-(--color-composer-accent-dark)" },
      { name: "--color-composer-accent-text", swatch: "bg-(--color-composer-accent-text)" },
      { name: "--color-composer-on-accent", swatch: "bg-(--color-composer-on-accent)" },
      { name: "--color-composer-link", swatch: "bg-(--color-composer-link)" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "--color-composer-error", swatch: "bg-(--color-composer-error)" },
      { name: "--color-composer-warning", swatch: "bg-(--color-composer-warning)" },
      { name: "--color-composer-positive", swatch: "bg-(--color-composer-positive)" },
      { name: "--color-composer-negative", swatch: "bg-(--color-composer-negative)" },
      { name: "--color-composer-explicit", swatch: "bg-(--color-composer-explicit)" },
    ],
  },
  {
    title: "Timeline",
    tokens: [
      { name: "--color-composer-wave", swatch: "bg-(--color-composer-wave)" },
      { name: "--color-composer-wave-progress", swatch: "bg-(--color-composer-wave-progress)" },
      { name: "--color-composer-snap", swatch: "bg-(--color-composer-snap)" },
      { name: "--color-composer-onset", swatch: "bg-(--color-composer-onset)" },
    ],
  },
];

const COLOR_TOKEN_NAMES = COLOR_GROUPS.flatMap((group) => group.tokens.map((token) => token.name));

// -- Components ----------------------------------------------------------------

const ColorSwatch: React.FC<{ token: ColorToken; value: string | undefined }> = ({ token, value }) => (
  <li className="flex items-center gap-3 min-w-0">
    <span aria-hidden className={cn("size-10 shrink-0 rounded-lg border border-(--divider)", token.swatch)} />
    <TokenLabel name={token.name} value={value} />
  </li>
);

const ColorTokens: React.FC = () => {
  const values = useResolvedTokens(COLOR_TOKEN_NAMES);
  const [probe] = useState(colorProbe);
  return (
    <div className="flex flex-col gap-8">
      {COLOR_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h3 className="text-[14.5px] font-semibold text-composer-text select-none">{group.title}</h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-4">
            {group.tokens.map((token) => (
              <ColorSwatch
                key={token.name}
                token={token}
                value={values[token.name] === undefined ? undefined : displayColor(values[token.name], probe)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ColorTokens };
