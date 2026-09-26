import type { RuleGroup } from "@/best-practices/model";
import { BACKGROUND_VOCALS } from "@/best-practices/rules/background-vocals";
import { LINES_AND_TEXT } from "@/best-practices/rules/lines-and-text";
import { SYLLABLES } from "@/best-practices/rules/syllables";
import { TIMING } from "@/best-practices/rules/timing";
import { VOICES } from "@/best-practices/rules/voices";

// -- Registry ------------------------------------------------------------------

const BEST_PRACTICE_GROUPS: RuleGroup[] = [LINES_AND_TEXT, BACKGROUND_VOCALS, VOICES, SYLLABLES, TIMING];

// -- Exports -------------------------------------------------------------------

export { BEST_PRACTICE_GROUPS };
