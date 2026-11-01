import { DesignSection } from "@/pages/design/design-section";
import { InteractionCells } from "@/pages/design/primitives/interaction-cells";
import { PrimitiveBlock, StateCell, StateGrid } from "@/pages/design/state-cell";
import { Checkbox } from "@/ui/checkbox";
import { SegmentedControl, type SegmentedOption } from "@/ui/segmented-control";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";
import { TabStrip, type TabStripTab } from "@/ui/tab-strip";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type LineFilter = "all" | "synced" | "unsynced";
type DemoTab = "edit" | "sync" | "preview";

// -- Constants -----------------------------------------------------------------

const LINE_FILTERS: readonly SegmentedOption<LineFilter>[] = [
  { value: "all", label: "All", count: 24 },
  { value: "synced", label: "Synced" },
  { value: "unsynced", label: "Unsynced", disabled: true },
];

const DEMO_TABS: readonly TabStripTab<DemoTab>[] = [
  { id: "edit", label: "Edit" },
  { id: "sync", label: "Sync" },
  { id: "preview", label: "Preview" },
];

const TAB_STRIP_NAV = { "aria-label": "Demo tabs" };

// -- Components ----------------------------------------------------------------

const DemoSlider: React.FC = () => {
  const [value, setValue] = useState(40);
  return <Slider value={value} min={0} max={100} onChange={setValue} aria-label="Volume" className="w-full" />;
};

const DemoSwitch: React.FC<{ initial: boolean; disabled?: boolean }> = ({ initial, disabled }) => {
  const [checked, setChecked] = useState(initial);
  return <Switch checked={checked} onCheckedChange={setChecked} label="Show waveform" disabled={disabled} />;
};

const DemoSegmented: React.FC = () => {
  const [value, setValue] = useState<LineFilter>("all");
  return <SegmentedControl value={value} options={LINE_FILTERS} onChange={setValue} aria-label="Show lines" />;
};

const DemoTabStrip: React.FC = () => {
  const [active, setActive] = useState<DemoTab>("edit");
  return <TabStrip tabs={DEMO_TABS} active={active} onSelect={setActive} navAttributes={TAB_STRIP_NAV} />;
};

const DemoCheckbox: React.FC<{ initial: boolean; disabled?: boolean }> = ({ initial, disabled }) => {
  const [checked, setChecked] = useState(initial);
  return (
    <Checkbox checked={checked} onCheckedChange={setChecked} disabled={disabled}>
      Loop the group
    </Checkbox>
  );
};

const ControlsSection: React.FC = () => (
  <DesignSection id="controls" note="Controls change a setting in place, without a separate save step.">
    <PrimitiveBlock name="Slider" note="Use it for a value on a range, such as volume or playback speed.">
      <StateGrid>
        <InteractionCells withDisabled={false} render={() => <DemoSlider />} />
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock name="Switch" note="Use it for a setting that takes effect the moment you flip it.">
      <StateGrid>
        <StateCell label="On">
          <DemoSwitch initial />
        </StateCell>
        <StateCell label="Off">
          <DemoSwitch initial={false} />
        </StateCell>
        <InteractionCells withDefault={false} render={(disabled) => <DemoSwitch initial disabled={disabled} />} />
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock
      name="SegmentedControl"
      note="Use it to pick one of two to four views or modes that sit side by side."
    >
      <StateGrid wide>
        <InteractionCells withDisabled={false} render={() => <DemoSegmented />} />
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock name="TabStrip" note="Use it to move between the main views of one screen.">
      <StateGrid wide>
        <InteractionCells withDisabled={false} render={() => <DemoTabStrip />} />
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock name="Checkbox" note="Use it for an option inside a form or prompt that applies when you confirm.">
      <StateGrid>
        <StateCell label="Checked">
          <DemoCheckbox initial />
        </StateCell>
        <StateCell label="Unchecked">
          <DemoCheckbox initial={false} />
        </StateCell>
        <InteractionCells withDefault={false} render={(disabled) => <DemoCheckbox initial disabled={disabled} />} />
      </StateGrid>
    </PrimitiveBlock>
  </DesignSection>
);

// -- Exports -------------------------------------------------------------------

export { ControlsSection };
