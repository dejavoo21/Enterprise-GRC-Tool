export function safeExternalReference(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
