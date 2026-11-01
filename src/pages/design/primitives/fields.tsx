import { DesignSection } from "@/pages/design/design-section";
import { InteractionCells } from "@/pages/design/primitives/interaction-cells";
import { PrimitiveBlock, StateCell, StateGrid } from "@/pages/design/state-cell";
import { IconField } from "@/ui/icon-field";
import { INPUT_STYLES } from "@/ui/input-styles";
import { SearchField } from "@/ui/search-field";
import { Select, type SelectOption } from "@/ui/select";
import { cn } from "@/utils/cn";
import { IconSearch } from "@tabler/icons-react";
import { useRef, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface DemoFieldProps {
  initial?: string;
  disabled?: boolean;
}

// -- Constants -----------------------------------------------------------------

const EXPORT_FORMATS: SelectOption[] = [
  { value: "ttml", label: "TTML" },
  { value: "lrc", label: "LRC" },
  { value: "srt", label: "SRT" },
  { value: "qrc", label: "QRC" },
];

// -- Components ----------------------------------------------------------------

const DemoInput: React.FC<DemoFieldProps> = ({ initial = "", disabled }) => {
  const [value, setValue] = useState(initial);
  return (
    <input
      type="text"
      aria-label="Song title"
      placeholder="Song title"
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      className={cn(INPUT_STYLES, "w-full h-8 select-text")}
    />
  );
};

const DemoIconField: React.FC<DemoFieldProps> = ({ initial = "", disabled }) => {
  const [value, setValue] = useState(initial);
  return (
    <IconField
      icon={IconSearch}
      aria-label="Search projects"
      placeholder="Search"
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      wrapperClassName="w-full"
    />
  );
};

const DemoSearchField: React.FC<{ initial?: string }> = ({ initial = "" }) => {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="w-full">
      <SearchField label="Search settings" value={value} onChange={setValue} inputRef={inputRef} />
    </div>
  );
};

const DemoSelect: React.FC<{ disabled: boolean }> = ({ disabled }) => {
  const [value, setValue] = useState("ttml");
  return (
    <Select
      aria-label="Export format"
      value={value}
      onChange={setValue}
      options={EXPORT_FORMATS}
      disabled={disabled}
      className="w-28"
    />
  );
};

const FieldsSection: React.FC = () => (
  <DesignSection
    id="fields"
    note="Fields hold what you type or pick. Each one has a label that screen readers announce."
  >
    <PrimitiveBlock name="Text input" note="Use INPUT_STYLES on any plain input, so every field shares one surface.">
      <StateGrid wide>
        <StateCell label="Empty, click or Tab to type">
          <DemoInput />
        </StateCell>
        <StateCell label="Filled">
          <DemoInput initial="Midnight City" />
        </StateCell>
        <StateCell label="Disabled">
          <DemoInput initial="Midnight City" disabled />
        </StateCell>
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock name="IconField" note="Use it when an icon tells you what the field is for, such as search.">
      <StateGrid wide>
        <StateCell label="Empty, click or Tab to type">
          <DemoIconField />
        </StateCell>
        <StateCell label="Filled">
          <DemoIconField initial="Midnight" />
        </StateCell>
        <StateCell label="Disabled">
          <DemoIconField disabled />
        </StateCell>
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock
      name="SearchField"
      note="Use it to filter a long list in a panel, with a clear button once you type."
    >
      <StateGrid wide>
        <StateCell label="Empty, click or Tab to type">
          <DemoSearchField />
        </StateCell>
        <StateCell label="Filled">
          <DemoSearchField initial="snap" />
        </StateCell>
      </StateGrid>
    </PrimitiveBlock>
    <PrimitiveBlock name="Select" note="Use it for one choice from a short list, in place of a native dropdown.">
      <StateGrid>
        <InteractionCells render={(disabled) => <DemoSelect disabled={disabled} />} />
      </StateGrid>
    </PrimitiveBlock>
  </DesignSection>
);

// -- Exports -------------------------------------------------------------------

export { FieldsSection };
