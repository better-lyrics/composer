// -- Freezing -----------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value) || ArrayBuffer.isView(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

// History entries share objects with the store; in development an in-place write throws at its source.
function freezeInDevelopment<T>(value: T): T {
  return import.meta.env.DEV ? deepFreeze(value) : value;
}

// -- Exports ------------------------------------------------------------------

export { freezeInDevelopment };
