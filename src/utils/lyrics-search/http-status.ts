// -- Guards -------------------------------------------------------------------

function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

// -- Exports ------------------------------------------------------------------

export { isClientError };
