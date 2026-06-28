/**
 * Shallow structural equality for flat objects of primitives — handy as a
 * `React.memo` comparator for list rows whose data object is recreated on every
 * live-query commit but whose field values usually don't change.
 */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a) as (keyof T)[];
  const bKeys = Object.keys(b) as (keyof T)[];
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}
