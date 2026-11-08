import type { Bus, WinterEvents } from '../state/events';
import type { SkyPlacement } from '../constellations/skyLayoutMath';
import type { FinaleCam } from './finaleSkyMath';
import type { StayAwhileAct } from './stayAwhile';
import { CENTRED, STAY_WORLD, activityForPan, homePlacement, homeProgress, panFromDrag, panFromKey, roamStart, roamStep, roamTurn, wanderCamera, type Pan, type Roam } from './stayWorldMath';

// Phase 28: stay a while's world, joined to the card. No three, no DOM, no draw calls, no words: it holds the pan and the clock and hands a view the numbers
// (`camera(aspect)`, `placement(aspect, id)`). The view (next session, in the full card) calls `update(dt)` each frame and feeds drags and keys in.
//   * it starts when stay a while does (`stay:enter`): the clock and the pan reset, so the first look is the valley exactly as the finale left it
//   * it only says "wander" or "constellations" (looking up) to the stay act, and never overrides pet / wishes / secrets, which other parts of the card set
//   * nothing here can end or block: `drag`, `key` and `recenter` always work, the pan is clamped, and `update` does nothing while she is not staying

export interface StayWorldOptions {
  stay: StayAwhileAct;
  bus?: Bus<WinterEvents>;
  reducedMotion?: boolean;
}

export interface StayWorld {
  update(dt: number): void;
  drag(dxPx: number, dyPx: number, widthPx: number): void;
  key(key: string): void;
  recenter(): void;
  /** free roam: walk (forward and right, each -1..1) until changed; (0, 0) stands still */
  move(forward: number, strafe: number): void;
  camera(aspect: number): FinaleCam;
  placement(aspect: number, id: string): SkyPlacement;
  state(): { time: number; pan: Pan; home: number; staying: boolean; roam: Roam };
  dispose(): void;
}

export function createStayWorld(o: StayWorldOptions): StayWorld {
  const reduced = !!o.reducedMotion;
  let t = 0;
  let pan: Pan = { ...CENTRED };
  let roam: Roam = roamStart();
  let walk: [number, number] = [0, 0];
  const offs: Array<() => void> = [];
  const label = (): void => {
    const a = o.stay.machine.activity;
    if (a !== 'wander' && a !== 'constellations') return;
    o.stay.setActivity(activityForPan({ yawDeg: pan.yawDeg, pitchDeg: roam.pitchDeg }));
  };
  const home = (): number => homeProgress(t, reduced);
  offs.push(
    (o.bus ?? o.stay.bus).on('stay:enter', () => {
      t = 0;
      pan = { ...CENTRED };
      roam = roamStart();
      walk = [0, 0];
    }),
  );
  return {
    update(dt) {
      if (!o.stay.machine.staying || !(dt > 0) || !Number.isFinite(dt)) return;
      t += Math.min(dt, 0.25);
      roam = roamStep(roam, walk[0], walk[1], dt);
    },
    drag(dx, dy, w) {
      pan = panFromDrag(pan, dx, dy, w);
      if (w > 0 && Number.isFinite(dx) && Number.isFinite(dy)) {
        const k = STAY_WORLD.dragDegPerScreen / w;
        roam = roamTurn(roam, -dx * k, dy * k);
      }
      label();
    },
    key(k) {
      pan = panFromKey(pan, k);
      const s = STAY_WORLD.keyStepDeg;
      if (k === 'ArrowLeft') roam = roamTurn(roam, -s, 0);
      else if (k === 'ArrowRight') roam = roamTurn(roam, s, 0);
      else if (k === 'ArrowUp') roam = roamTurn(roam, 0, s);
      else if (k === 'ArrowDown') roam = roamTurn(roam, 0, -s);
      else if (k === 'Home') roam = { ...roam, headingDeg: 0, pitchDeg: 0, target: 0 };
      label();
    },
    recenter() {
      pan = { ...CENTRED };
      roam = { ...roam, headingDeg: 0, pitchDeg: 0, target: 0 };
      label();
    },
    move(f, s) {
      walk = [Number.isFinite(f) ? f : 0, Number.isFinite(s) ? s : 0];
    },
    camera: (aspect) => wanderCamera(aspect, t, pan, reduced, roam),
    placement: (aspect, id) => homePlacement(aspect, id, home()),
    state: () => ({ time: t, pan: { ...pan }, home: home(), staying: o.stay.machine.staying, roam: { ...roam } }),
    dispose: () => offs.forEach((f) => f()),
  };
}
