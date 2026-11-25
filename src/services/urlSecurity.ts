/**
 * SEC-09 URL allowlist and HTML escaping helpers for receipt links/previews.
 */

export const MAX_RECEIPT_URL_LENGTH = 2048;

const FIREBASE_STORAGE_HOST_REGEX = /^[a-z0-9-]+\.firebasestorage\.app$/i;

const ALLOWED_STATIC_HOSTS = new Set<string>([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeReceiptUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RECEIPT_URL_LENGTH) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;

  const host = parsed.hostname.toLowerCase();
  return ALLOWED_STATIC_HOSTS.has(host) || FIREBASE_STORAGE_HOST_REGEX.test(host);
}

export function sanitizeReceiptUrl(rawUrl: unknown): string | null {
  if (!isSafeReceiptUrl(rawUrl)) return null;
  return (rawUrl as string).trim();
}
