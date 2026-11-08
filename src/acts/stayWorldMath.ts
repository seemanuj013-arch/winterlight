// Phase 28: the look of "stay a while", as numbers. Pure (no three, no DOM, no clock, no random): numbers in, numbers out, so a frozen frame, a test and the page agree.
//
//   * the camera starts where the finale left it (the valley, `valleyCamera`), drifts a very little (a slow sway, none under reduced motion) and can be turned by hand:
//     a drag, or the arrow keys, turn the view left / right and up / down within limits; Home puts it back. Looking up far enough shows the sky, and that is all "constellations" means here.
//   * the five shapes come home from the crown to their patches (`homePlacement`), so the sky is hers to play again.
// Nothing here is a mechanic that can fail or end: the pan is always clamped, there is no timer that ends anything, and no word is written here. Every number is `[A]`.

import { valleyCamera, finalePlacement, type FinaleCam } from './finaleSkyMath';
import type { SkyPlacement } from '../constellations/skyLayoutMath';
import type { V3 } from '../core/directorMath';

const D2R = Math.PI / 180;
const clamp = (x: number, lo: number, hi: number): number => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);

export const STAY_WORLD = {
  /** `[A]` the slow sway: period (s) and reach (m, sideways and up) */
  driftPeriodS: 48,
  driftM: [0.7, 0.25] as readonly [number, number],
  /** `[A]` how far the view can be turned by hand (degrees from the valley look; positive = right). The five patches sit LEFT of the valley look (the valley look is about 26 degrees right of straight ahead) and up to about 64 degrees above the horizon on a tall phone, so the range is lopsided and tall: found by `tools/stay_reach.py`, which showed the cat-and-bunny shape could never be brought on screen with the first numbers (+-40, up to 48). */
  yawRangeDeg: [-55, 40] as readonly [number, number],
  pitchLimitDeg: [-8, 68] as readonly [number, number],
  /** `[A]` a drag across the whole screen turns the view this far; one arrow-key press turns it `keyStepDeg` */
  dragDegPerScreen: 70,
  keyStepDeg: 6,
  /** `[A]` looking up at least this far (degrees from the valley look) counts as being at the constellations */
  skyLookPitchDeg: 22,
  /** `[A]` the five shapes take this long to come home from the crown (s); under reduced motion they are simply there */
  homeSeconds: 2.4,
  /** the share of the way home spent moving across (the rest is settling down onto the patch) */
  acrossShare: 0.7,
} as const;

export interface Pan {
  /** degrees, positive = looking to the right of the valley look */
  yawDeg: number;
  /** degrees, positive = looking higher */
  pitchDeg: number;
}

export const CENTRED: Pan = { yawDeg: 0, pitchDeg: 0 };

export function clampPan(p: Pan): Pan {
  return {
    yawDeg: clamp(p.yawDeg, STAY_WORLD.yawRangeDeg[0], STAY_WORLD.yawRangeDeg[1]),
    pitchDeg: clamp(p.pitchDeg, STAY_WORLD.pitchLimitDeg[0], STAY_WORLD.pitchLimitDeg[1]),
  };
}

/** a drag of (dx, dy) px on a screen `widthPx` wide: the world follows the finger, so a drag right turns the view left and a drag down turns it up. Bad numbers change nothing. */
export function panFromDrag(pan: Pan, dxPx: number, dyPx: number, widthPx: number): Pan {
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx) || !(widthPx > 0)) return clampPan(pan);
  const k = STAY_WORLD.dragDegPerScreen / widthPx;
  return clampPan({ yawDeg: pan.yawDeg - dxPx * k, pitchDeg: pan.pitchDeg + dyPx * k });
}

/** the arrow keys turn the view; Home puts it back; any other key changes nothing */
export function panFromKey(pan: Pan, key: string): Pan {
  const s = STAY_WORLD.keyStepDeg;
  switch (key) {
    case 'ArrowLeft':
      return clampPan({ ...pan, yawDeg: pan.yawDeg - s });
    case 'ArrowRight':
      return clampPan({ ...pan, yawDeg: pan.yawDeg + s });
    case 'ArrowUp':
      return clampPan({ ...pan, pitchDeg: pan.pitchDeg + s });
    case 'ArrowDown':
      return clampPan({ ...pan, pitchDeg: pan.pitchDeg - s });
    case 'Home':
      return { ...CENTRED };
    default:
      return clampPan(pan);
  }
}

/** the activity label the view says: at the sky when she looks up far enough, otherwise wandering */
export function activityForPan(pan: Pan): 'wander' | 'constellations' {
  return pan.pitchDeg >= STAY_WORLD.skyLookPitchDeg ? 'constellations' : 'wander';
}

/** the camera `t` seconds into stay a while: the valley look, swayed a little (not under reduced motion), turned by `pan` (clamped) */
export function wanderCamera(aspect: number, t: number, pan: Pan, reduced: boolean): FinaleCam {
  const base = valleyCamera(aspect);
  const p = clampPan(pan);
  const tt = Number.isFinite(t) ? t : 0;
  const sway = reduced ? 0 : 1;
  const w = (2 * Math.PI * tt) / STAY_WORLD.driftPeriodS;
  const eye: V3 = [
    base.eye[0] + sway * STAY_WORLD.driftM[0] * Math.sin(w),
    base.eye[1] + sway * STAY_WORLD.driftM[1] * Math.sin(w * 1.37 + 1),
    base.eye[2],
  ];
  const d: V3 = [base.look[0] - base.eye[0], base.look[1] - base.eye[1], base.look[2] - base.eye[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const h = Math.atan2(d[0], -d[2]) + p.yawDeg * D2R;
  const e = Math.asin(d[1] / l) + p.pitchDeg * D2R;
  const dir: V3 = [Math.sin(h) * Math.cos(e), Math.sin(e), -Math.cos(h) * Math.cos(e)];
  return { eye, look: [eye[0] + dir[0] * 20, eye[1] + dir[1] * 20, eye[2] + dir[2] * 20], fovDeg: base.fovDeg };
}

/** 0..1: how far the five shapes have come home, `t` seconds after stay a while began (reduced motion: already home) */
export function homeProgress(t: number, reduced: boolean): number {
  if (reduced) return 1;
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.min(1, t / STAY_WORLD.homeSeconds);
}

/** shape `id` at home progress `k`: 0 is the crown exactly as the finale left it, 1 is on its own patch exactly as in Phase 22; across first, then down onto the patch */
export function homePlacement(aspect: number, id: string, k: number): SkyPlacement {
  const q = Math.min(1, Math.max(0, Number.isFinite(k) ? k : 0));
  const a = STAY_WORLD.acrossShare;
  const join = 1 - Math.min(1, q / a);
  const lift = 1 - Math.min(1, Math.max(0, (q - a) / (1 - a)));
  return finalePlacement(aspect, id, lift, join);
}
