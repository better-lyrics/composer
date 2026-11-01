import { DesignSection } from "@/pages/design/design-section";
import { StateCell } from "@/pages/design/state-cell";
import { type StateChip, StateChips } from "@/pages/design/state-chips";
import { useDemoNoticeKinds } from "@/pages/design/states/demo-notice-kinds";
import { type EscapeLayerKind, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { Button } from "@/ui/button";
import { HeaderNotices } from "@/ui/notices/header-notices";

// -- Types ---------------------------------------------------------------------

type EscapeLayersState = EscapeLayerKind | "none";

// -- Constants -----------------------------------------------------------------

const STATES: readonly StateChip<EscapeLayersState>[] = [
  { id: "none", label: "No layers", hint: "Close everything, or press Escape until nothing is open." },
  { id: "panel", label: "Panel", hint: "Open the suggestions list." },
  { id: "modal", label: "Modal", hint: "Open the list, then show all grouping suggestions." },
];

const KIND_LABEL: Record<EscapeLayerKind, string> = { panel: "Panel", modal: "Modal" };

// -- Components ----------------------------------------------------------------

const LayerReadout: React.FC<{ kinds: readonly EscapeLayerKind[] }> = ({ kinds }) => (
  <p className="text-xs text-(--muted) tabular-nums select-text cursor-text">
    {kinds.length === 0 ? "Stack is empty" : `Bottom to top: ${kinds.map((kind) => KIND_LABEL[kind]).join(" ・ ")}`}
  </p>
);

const EscapeLayersDemo: React.FC = () => {
  const demo = useDemoNoticeKinds();
  const layers = useEscapeLayerStackStore((s) => s.layers);
  const kinds = layers.map((layer) => layer.kind);

  return (
    <DesignSection
      id="escape-layers"
      note="Panels and modals join one stack as they open, and Escape closes only the top layer. Here the suggestions list is a panel. Its review list closes the panel and opens a modal in its place."
    >
      <StateChips label="Escape layer states" states={STATES} current={kinds.at(-1) ?? "none"} />
      <StateCell label="A header with suggestions">
        <div className="flex w-full max-w-xl flex-col items-end gap-3">
          <div className="flex w-full items-center gap-2">
            <Button size="sm" variant="ghost" onClick={demo.reset}>
              Reset suggestions
            </Button>
            <HeaderNotices kinds={demo.kinds} />
          </div>
          <LayerReadout kinds={kinds} />
        </div>
      </StateCell>
    </DesignSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { EscapeLayersDemo };
