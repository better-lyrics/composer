// -- Types --------------------------------------------------------------------

type SavedAudioSource = { kind: "file"; name: string } | { kind: "youtube"; videoId: string };

// -- Exports ------------------------------------------------------------------

export type { SavedAudioSource };
