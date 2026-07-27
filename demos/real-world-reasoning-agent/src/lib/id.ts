let counter = 0;

/** Monotonic, collision-free id for markers, routes, chat msgs, tool events. */
export function uid(prefix = 'a'): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
