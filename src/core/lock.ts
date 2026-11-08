export const UNLOCK_AT_ISO = '2026-11-10T00:00:00+05:30';

export interface LockState {
  locked: boolean;
  msRemaining: number;
}

export function lockState(nowMs: number, unlockAtIso: string = UNLOCK_AT_ISO): LockState {
  const target = Date.parse(unlockAtIso);
  if (Number.isNaN(target)) throw new Error('Bad unlock date: ' + unlockAtIso);
  const msRemaining = Math.max(0, target - nowMs);
  return { locked: msRemaining > 0, msRemaining };
}

export function splitRemaining(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.floor(ms / 1000);
  return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
