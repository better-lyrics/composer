// -- Types ---------------------------------------------------------------------

interface CobaltInstance {
  id: string;
  label: string;
  url: string;
}

interface CobaltInstanceStatus {
  status: "success" | "error";
  errorMessage?: string;
  at: number;
}

// -- Exports -------------------------------------------------------------------

export type { CobaltInstance, CobaltInstanceStatus };
