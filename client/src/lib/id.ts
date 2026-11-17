/**
 * Generates an RFC4122 v4 UUID safely in both secure (HTTPS / localhost)
 * and insecure contexts (e.g. accessing via local network or EC2 IP over HTTP),
 * where `crypto.randomUUID` is not available in the browser.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const safeRandomUUID = uuid;
export const generateUUID = uuid;
