import { keyBadge, keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
import { useSettingsStore } from "@/stores/settings";
import {
  IconArrowBack,
  IconKeyboard,
  IconMicrophone,
  IconScissors,
  IconSelectAll,
  IconStack2,
  IconTypography,
  IconUser,
} from "@tabler/icons-react";

// -- Components ---------------------------------------------------------------

// Shows the split character you chose in Settings, so the tip names the key you actually type.
const PresplitGist: React.FC = () => {
  const splitCharacter = useSettingsStore((state) => state.splitCharacter);
  return (
    <>
      Type {keyBadge(splitCharacter)} inside a word, like "hel{splitCharacter}lo", to sync it in syllables.
    </>
  );
};

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("edit");

const EDIT_TIPS = [
  tip({
    id: "type",
    tier: "basics",
    icon: IconTypography,
    title: "Type or paste the words",
    gist: <>One line here for each line that's sung.</>,
  }),
  tip({
    id: "playWhileTyping",
    tier: "basics",
    icon: IconKeyboard,
    title: "Keep your hands on the keys",
    gist: (
      <>
        {keys("global.playPauseWhileTyping")} plays and pauses, {keys("global.seekBackwardWhileTyping")} goes back a
        bit.
      </>
    ),
  }),
  tip({
    id: "singer",
    tier: "basics",
    icon: IconUser,
    title: "Say who sings",
    gist: <>Name your singers under Agents. With two or more, click a line's tag to switch.</>,
  }),
  tip({
    id: "background",
    tier: "further",
    icon: IconMicrophone,
    title: "Pull out background vocals",
    gist: (
      <>Words in parentheses, like "(ooh)", become a background vocal. Extract background vocals pulls out any left.</>
    ),
    spot: { stage: "edit", spot: "extractAll", text: 'Pull every "(...)" out at once here' },
  }),
  tip({
    id: "lineRange",
    tier: "further",
    icon: IconSelectAll,
    title: "Select many lines",
    gist: <>Click a line, then {keyBadge("Shift")}+click another to select everything between.</>,
  }),
  tip({
    id: "refocus",
    tier: "further",
    icon: IconArrowBack,
    title: "Jump back into the lyrics",
    gist: <>Press {keys("global.goToEdit")} to put the cursor back in the text.</>,
  }),
  tip({
    id: "presplit",
    tier: "pro",
    icon: IconScissors,
    title: "Split long words ahead of time",
    gist: <PresplitGist />,
  }),
  tip({
    id: "group",
    tier: "pro",
    icon: IconStack2,
    title: "Group a repeating chorus",
    gist: <>Click Group on a grouping suggestion and you only sync the chorus once.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { EDIT_TIPS };
