// Phase 28: the look of "stay a while", as numbers. Pure (no three, no DOM, no clock, no random): numbers in, numbers out, so a frozen frame, a test and the page agree.
//
//   * the camera starts where the finale left it (the valley, `valleyCamera`), drifts a very little (a slow sway, none under reduced motion) and can be turned by hand:
//     a drag, or the arrow keys, turn the view left / right and up / down within limits; Home puts it back. Looking up far enough shows the sky, and that is all "constellations" means here.
//   * the five shapes come home from the crown to their patches (`homePlacement`), so the sky is hers to play again.
// Nothing here is a mechanic that can fail or end: the pan is always clamped, there is no timer that ends anything, and no word is written here. Every number is `[A]`.

import { valleyCamera, finalePlacement, type FinaleCam } from './finaleSkyMath';
import type { SkyPlacement } from '../constellations/skyLayoutMath';
import type { V3 } from '../core/directorMath';
import { terrainHeight, CABIN_SITE } from '../world/groundMath';

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

/** Free roam (owner's ask): after the last act she can walk anywhere in the valley and go right up to the animals. `[A]` numbers. */
export const ROAM = {
  speedMps: 3.2,
  /** eye height above the snow once she is on her feet (m) */
  eyeAboveSnow: 1.5,
  /** she cannot walk farther than this from the middle of the valley (the snow ends at 35 m) */
  radiusM: 28,
  /** a soft wall round the cabin so she does not walk through it (m) */
  cabinKeepOutM: 3.6,
  /** seconds to come down from the valley view to her own eye height (and to go back) */
  blendSeconds: 1.4,
  /** how far down she may look once she is on her feet, to see a small animal at her feet */
  pitchDownDeg: -50,
} as const;

export interface Roam {
  x: number;
  z: number;
  /** degrees from the valley look, NOT clamped: she can turn all the way round */
  headingDeg: number;
  pitchDeg: number;
  /** 0 = the valley view, 1 = on her feet */
  blend: number;
  target: 0 | 1;
}

const smooth01 = (x: number): number => {
  const q = Math.min(1, Math.max(0, x));
  return q * q * (3 - 2 * q);
};

export function roamStart(): Roam {
  const e = valleyCamera(1).eye;
  return { x: e[0], z: e[2], headingDeg: 0, pitchDeg: 0, blend: 0, target: 0 };
}

export function pitchFloorDeg(blend: number): number {
  const k = Math.min(1, Math.max(0, Number.isFinite(blend) ? blend : 0));
  return STAY_WORLD.pitchLimitDeg[0] + (ROAM.pitchDownDeg - STAY_WORLD.pitchLimitDeg[0]) * k;
}

/** the view turned by (dYaw, dPitch) degrees: yaw is free, pitch is limited */
export function roamTurn(r: Roam, dYawDeg: number, dPitchDeg: number): Roam {
  const dy = Number.isFinite(dYawDeg) ? dYawDeg : 0;
  const dp = Number.isFinite(dPitchDeg) ? dPitchDeg : 0;
  return { ...r, headingDeg: r.headingDeg + dy, pitchDeg: clamp(r.pitchDeg + dp, pitchFloorDeg(r.blend), STAY_WORLD.pitchLimitDeg[1]) };
}

/** walk for `dt` seconds: `fwd` and `strafe` are -1..1 (forward / right); she stays inside the valley and out of the cabin */
export function roamStep(r: Roam, fwd: number, strafe: number, dt: number): Roam {
  let blend = r.blend;
  if (Number.isFinite(dt) && dt > 0) {
    const step = Math.min(dt, 0.25) / ROAM.blendSeconds;
    blend = r.target === 1 ? Math.min(1, blend + step) : Math.max(0, blend - step);
  }
  const f = clamp(fwd, -1, 1);
  const s = clamp(strafe, -1, 1);
  const mag = Math.hypot(f, s);
  if (!(mag > 0) || !(dt > 0) || !Number.isFinite(dt)) return { ...r, blend };
  const base = valleyCamera(1);
  const h = Math.atan2(base.look[0] - base.eye[0], -(base.look[2] - base.eye[2])) + r.headingDeg * D2R;
  const k = (ROAM.speedMps * Math.min(dt, 0.25)) / Math.max(1, mag);
  let x = r.x + (Math.sin(h) * f + Math.cos(h) * s) * k;
  let z = r.z + (-Math.cos(h) * f + Math.sin(h) * s) * k;
  const d = Math.hypot(x, z);
  if (d > ROAM.radiusM) {
    x *= ROAM.radiusM / d;
    z *= ROAM.radiusM / d;
  }
  const cx = x - CABIN_SITE.x;
  const cz = z - CABIN_SITE.z;
  const cd = Math.hypot(cx, cz);
  if (cd < ROAM.cabinKeepOutM) {
    const u = cd > 1e-6 ? ROAM.cabinKeepOutM / cd : 1;
    x = CABIN_SITE.x + (cd > 1e-6 ? cx * u : ROAM.cabinKeepOutM);
    z = CABIN_SITE.z + (cd > 1e-6 ? cz * u : 0);
  }
  return { ...r, x, z, blend, target: 1 };
}

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
export function wanderCamera(aspect: number, t: number, pan: Pan, reduced: boolean, roam?: Roam): FinaleCam {
  const base = valleyCamera(aspect);
  const p = clampPan(pan);
  const k = roam ? smooth01(roam.blend) : 0;
  const yawDeg = roam ? roam.headingDeg : p.yawDeg;
  const pitchDeg = roam ? roam.pitchDeg : p.pitchDeg;
  const tt = Number.isFinite(t) ? t : 0;
  const sway = (reduced ? 0 : 1) * (1 - k);
  const w = (2 * Math.PI * tt) / STAY_WORLD.driftPeriodS;
  const swayed: V3 = [
    base.eye[0] + sway * STAY_WORLD.driftM[0] * Math.sin(w),
    base.eye[1] + sway * STAY_WORLD.driftM[1] * Math.sin(w * 1.37 + 1),
    base.eye[2],
  ];
  const eye: V3 = roam && k > 0
    ? [swayed[0] + (roam.x - swayed[0]) * k, swayed[1] + (terrainHeight(roam.x, roam.z) + ROAM.eyeAboveSnow - swayed[1]) * k, swayed[2] + (roam.z - swayed[2]) * k]
    : swayed;
  const d: V3 = [base.look[0] - base.eye[0], base.look[1] - base.eye[1], base.look[2] - base.eye[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const h = Math.atan2(d[0], -d[2]) + yawDeg * D2R;
  const e = (Math.asin(d[1] / l)) * (1 - k) + pitchDeg * D2R;
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
