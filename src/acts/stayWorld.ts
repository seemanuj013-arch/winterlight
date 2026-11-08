import type { Bus, WinterEvents } from '../state/events';
import type { SkyPlacement } from '../constellations/skyLayoutMath';
import type { FinaleCam } from './finaleSkyMath';
import type { StayAwhileAct } from './stayAwhile';
import { CENTRED, activityForPan, homePlacement, homeProgress, panFromDrag, panFromKey, wanderCamera, type Pan } from './stayWorldMath';

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
  camera(aspect: number): FinaleCam;
  placement(aspect: number, id: string): SkyPlacement;
  state(): { time: number; pan: Pan; home: number; staying: boolean };
  dispose(): void;
}

export function createStayWorld(o: StayWorldOptions): StayWorld {
  const reduced = !!o.reducedMotion;
  let t = 0;
  let pan: Pan = { ...CENTRED };
  const offs: Array<() => void> = [];
  const label = (): void => {
    const a = o.stay.machine.activity;
    if (a !== 'wander' && a !== 'constellations') return;
    o.stay.setActivity(activityForPan(pan));
  };
  const home = (): number => homeProgress(t, reduced);
  offs.push(
    (o.bus ?? o.stay.bus).on('stay:enter', () => {
      t = 0;
      pan = { ...CENTRED };
    }),
  );
  return {
    update(dt) {
      if (!o.stay.machine.staying || !(dt > 0) || !Number.isFinite(dt)) return;
      t += Math.min(dt, 0.25);
    },
    drag(dx, dy, w) {
      pan = panFromDrag(pan, dx, dy, w);
      label();
    },
    key(k) {
      pan = panFromKey(pan, k);
      label();
    },
    recenter() {
      pan = { ...CENTRED };
      label();
    },
    camera: (aspect) => wanderCamera(aspect, t, pan, reduced),
    placement: (aspect, id) => homePlacement(aspect, id, home()),
    state: () => ({ time: t, pan: { ...pan }, home: home(), staying: o.stay.machine.staying }),
    dispose: () => offs.forEach((f) => f()),
  };
}
