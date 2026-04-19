export function isEmpty(x: unknown): x is null | undefined {
  return x === null || x === undefined;
}

export function isFilled<T>(x: T): x is Exclude<T, null | undefined> {
  return x !== null && x !== undefined;
}
