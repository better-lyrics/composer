// -- Functions ----------------------------------------------------------------

function fileIdentityKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

// -- Exports ------------------------------------------------------------------

export { fileIdentityKey };
