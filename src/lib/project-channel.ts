import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface ProjectsDeletedMessage {
  type: "projects-deleted";
  ids: string[];
  sender: string;
}

// -- Constants ----------------------------------------------------------------

const PROJECT_CHANNEL_NAME = "ttml-composer-projects";
const TAB_ID = nanoid();

// -- Module state -------------------------------------------------------------

let senderChannel: BroadcastChannel | null = null;

// -- Helpers ------------------------------------------------------------------

function isProjectsDeletedMessage(value: unknown): value is ProjectsDeletedMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ProjectsDeletedMessage>;
  return (
    message.type === "projects-deleted" &&
    Array.isArray(message.ids) &&
    message.ids.every((id) => typeof id === "string") &&
    typeof message.sender === "string"
  );
}

// -- Public API ---------------------------------------------------------------

function announceProjectsDeleted(ids: readonly string[]): void {
  if (ids.length === 0 || typeof BroadcastChannel === "undefined") return;
  senderChannel ??= new BroadcastChannel(PROJECT_CHANNEL_NAME);
  const message: ProjectsDeletedMessage = { type: "projects-deleted", ids: [...ids], sender: TAB_ID };
  senderChannel.postMessage(message);
}

function subscribeProjectsDeleted(listener: (ids: string[]) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(PROJECT_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isProjectsDeletedMessage(event.data) && event.data.sender !== TAB_ID) listener(event.data.ids);
  };
  return () => channel.close();
}

// -- Exports ------------------------------------------------------------------

export { PROJECT_CHANNEL_NAME, announceProjectsDeleted, subscribeProjectsDeleted };
