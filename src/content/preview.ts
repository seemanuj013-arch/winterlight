import { lockState, type LockState } from '../core/lock';

/** Open the card early with `?preview=<key>`. The key lives in the VITE_PREVIEW_KEY env var, never in the repo. */
export const PREVIEW_PARAM = 'preview';

type Digest = (text: string) => Promise<string>;

/** SHA-256 as lowercase hex via WebCrypto. Rejects when WebCrypto is unavailable (non-secure context). */
export const sha256Hex: Digest = async (text) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * True only if the URL carries the right key. `expectedHash` is the build-time SHA-256 of the key;
 * an empty hash (no key configured, or a too-short one) means preview is off for everybody.
 * Any failure (no WebCrypto, odd URL) means "not preview": the card stays locked.
 */
export async function isPreviewRequested(search: string, expectedHash: string, digest: Digest = sha256Hex): Promise<boolean> {
  if (!expectedHash) return false;
  const candidate = new URLSearchParams(search).get(PREVIEW_PARAM);
  if (!candidate) return false;
  try {
    return (await digest(candidate)) === expectedHash.toLowerCase();
  } catch {
    return false;
  }
}

/** The lock, unless preview is on. */
export function effectiveLock(nowMs: number, preview: boolean): LockState {
  return preview ? { locked: false, msRemaining: 0 } : lockState(nowMs);
}
