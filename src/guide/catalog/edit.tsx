import { keyBadge, keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
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
    gist: <>Words in parentheses, like "(ooh)", can become a background vocal.</>,
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
    gist: <>Type the split character inside a word to sync it in syllables.</>,
  }),
  tip({
    id: "group",
    tier: "pro",
    icon: IconStack2,
    title: "Group a repeating chorus",
    gist: <>Accept a grouping suggestion and you only sync the chorus once.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { EDIT_TIPS };
