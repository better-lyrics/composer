// -- Functions ----------------------------------------------------------------

function memoByIdentity<Key extends object, Value>(derive: (key: Key) => Value): (key: Key) => Value {
  const cache = new WeakMap<Key, { value: Value }>();
  return (key) => {
    const cached = cache.get(key);
    if (cached) return cached.value;
    const value = derive(key);
    cache.set(key, { value });
    return value;
  };
}

// Values read with a split character, recomputed only when the character changes.
function memoBySplitCharacter<Key extends object, Value>(
  derive: (key: Key, splitChar: string) => Value,
): (key: Key, splitChar: string) => Value {
  const cache = new WeakMap<Key, { splitChar: string; value: Value }>();
  return (key, splitChar) => {
    const cached = cache.get(key);
    if (cached?.splitChar === splitChar) return cached.value;
    const value = derive(key, splitChar);
    cache.set(key, { splitChar, value });
    return value;
  };
}

// -- Exports ------------------------------------------------------------------

export { memoByIdentity, memoBySplitCharacter };
