export function isSafeExternalReference(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
