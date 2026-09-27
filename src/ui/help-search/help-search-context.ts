import { createContext } from "react";

// -- Context -------------------------------------------------------------------

type OpenHelpTopic = (section: string, title: string) => void;

const HelpSearchContext = createContext<OpenHelpTopic | null>(null);

// -- Exports -------------------------------------------------------------------

export { HelpSearchContext };
export type { OpenHelpTopic };
