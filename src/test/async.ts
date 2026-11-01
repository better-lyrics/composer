// -- Helpers ------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Exports ------------------------------------------------------------------

export { sleep };
