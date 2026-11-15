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

// -- Exports ------------------------------------------------------------------

export { memoByIdentity };
