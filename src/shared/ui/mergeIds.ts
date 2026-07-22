export function mergeIds(...values: Array<string | false | null | undefined>): string | undefined {
  const ids = values.filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
