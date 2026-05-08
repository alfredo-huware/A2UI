/** Resolve "$state.foo.bar" against a state object. Returns undefined if missing. */
export function resolveBinding(source: string, state: Record<string, unknown>): unknown {
  if (!source.startsWith("$state")) return undefined;
  const path = source.slice("$state".length).replace(/^\./, "");
  if (!path) return state;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, state);
}

/** Set "foo.bar" inside a state object immutably. */
export function setBinding(
  state: Record<string, unknown>,
  source: string,
  value: unknown,
): Record<string, unknown> {
  if (!source.startsWith("$state")) return state;
  const path = source.slice("$state".length).replace(/^\./, "");
  if (!path) return (typeof value === "object" && value ? (value as Record<string, unknown>) : state);
  const keys = path.split(".");
  const next: Record<string, unknown> = { ...state };
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const existing = cursor[k];
    cursor[k] = existing && typeof existing === "object" ? { ...(existing as Record<string, unknown>) } : {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}
