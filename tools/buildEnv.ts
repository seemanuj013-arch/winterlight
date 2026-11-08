// Build-time helpers used by vite.config.ts (node only). Kept here so tests can reach them.
import { createHash } from 'node:crypto';

export const MIN_PREVIEW_KEY_LENGTH = 16;

type Env = Record<string, string | undefined>;

/** Strict (placeholders refuse to ship) on Vercel's production environment, or when WINTERLIGHT_STRICT=1. Preview builds of `dev` stay lenient. */
export function isStrictEnv(env: Env): boolean {
  return env.VERCEL_ENV === 'production' || env.WINTERLIGHT_STRICT === '1';
}

/** SHA-256 hex of the key, so the key itself never lands in the shipped JS. '' for no key or a key too short to be safe. */
export function previewHashFor(key: string | undefined): string {
  if (!key || key.length < MIN_PREVIEW_KEY_LENGTH) return '';
  return createHash('sha256').update(key, 'utf8').digest('hex');
}
