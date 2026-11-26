/**
 * SEC-17 Mobile: Cryptographically strong random token generation via Web Crypto API.
 */

export const generateSecureRandomToken = (byteLength: number = 8): string => {
  const safeBytes =
    typeof byteLength === 'number' && Number.isFinite(byteLength) && byteLength >= 1
      ? Math.min(64, Math.floor(byteLength))
      : 8;
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Web Crypto CSPRNG indisponible.');
  }
  const buf = new Uint8Array(safeBytes);
  cryptoObj.getRandomValues(buf);
  let hex = '';
  for (let i = 0; i < buf.length; i += 1) {
    hex += buf[i].toString(16).padStart(2, '0');
  }
  return hex;
};
