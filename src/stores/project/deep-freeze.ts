// -- Freezing -----------------------------------------------------------------

// History entries share objects with the store, so an in-place write must throw at its source instead of corrupting undo.
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value) || ArrayBuffer.isView(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

// -- Exports ------------------------------------------------------------------

export { deepFreeze };
