import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type {
  OverscrollAction,
  OverscrollTouchInput,
  OverscrollWheelInput
} from './overscroll-gesture.ts';

import { NavigationAction } from './navigation-action.ts';
import {
  NEW_GESTURE_GAP_IN_MILLISECONDS,
  OverscrollGesture,
  OverscrollUpdateKind,
  PULL_PAUSE_IN_MILLISECONDS
} from './overscroll-gesture.ts';

const THRESHOLD = 300;
const NOTCH = 100;
const MOMENTUM_INTERVAL_IN_MILLISECONDS = 16;

function hasAnyTarget(): boolean {
  return true;
}

describe('OverscrollGesture', () => {
  let gesture: OverscrollGesture;
  let time: number;

  beforeEach(() => {
    gesture = new OverscrollGesture();
    time = 0;
  });

  function wheel(delta: number, overrides: Partial<OverscrollWheelInput> = {}): ReturnType<OverscrollGesture['wheel']> {
    return gesture.wheel({
      delta,
      hasTarget: hasAnyTarget,
      isAtBottom: true,
      isAtTop: true,
      threshold: THRESHOLD,
      time,
      ...overrides
    });
  }

  function touchInput(y: number, overrides: Partial<OverscrollTouchInput> = {}): OverscrollTouchInput {
    return {
      hasTarget: hasAnyTarget,
      isAtBottom: true,
      isAtTop: false,
      threshold: THRESHOLD,
      y,
      ...overrides
    };
  }

  describe('with a wheel', () => {
    it('starts a pull at the edge, shows its progress, and opens the target once it passes the threshold', () => {
      expect(wheel(NOTCH)).toStrictEqual({ action: NavigationAction.Next, hasTarget: true, isReady: false, kind: OverscrollUpdateKind.Pull, progress: 1 / 3 });
      time += NOTCH;
      expect(wheel(NOTCH)).toMatchObject({ kind: OverscrollUpdateKind.Pull, progress: 2 / 3 });
      time += NOTCH;
      expect(wheel(NOTCH)).toStrictEqual({ action: NavigationAction.Next, kind: OverscrollUpdateKind.Commit });
    });

    it('pulls up past the top edge to the previous item', () => {
      expect(wheel(-NOTCH)).toMatchObject({ action: NavigationAction.Previous, kind: OverscrollUpdateKind.Pull });
    });

    it('does nothing while the note is not at the edge it scrolls toward', () => {
      expect(wheel(NOTCH, { isAtBottom: false })).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
      expect(wheel(-NOTCH, { isAtTop: false })).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('ignores the momentum of a fling that reaches the edge, and starts a pull only after a pause', () => {
      wheel(NOTCH, { isAtBottom: false });
      for (let index = 0; index < 50; index++) {
        time += MOMENTUM_INTERVAL_IN_MILLISECONDS;
        expect(wheel(NOTCH)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
      }
      time += NEW_GESTURE_GAP_IN_MILLISECONDS;
      expect(wheel(NOTCH)).toMatchObject({ kind: OverscrollUpdateKind.Pull });
    });

    it('cancels the pull when the scroll turns back', () => {
      wheel(NOTCH);
      time += MOMENTUM_INTERVAL_IN_MILLISECONDS;
      expect(wheel(-NOTCH)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
      // The turn was part of the same gesture, so pulling on starts nothing until a new one.
      time += MOMENTUM_INTERVAL_IN_MILLISECONDS;
      expect(wheel(NOTCH)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('starts afresh after a pause', () => {
      wheel(NOTCH);
      time += NOTCH;
      wheel(NOTCH);
      time += PULL_PAUSE_IN_MILLISECONDS;
      expect(wheel(NOTCH)).toMatchObject({ progress: 1 / 3 });
    });

    it('drops the pull when cancelled', () => {
      wheel(NOTCH);
      gesture.cancel();
      time += MOMENTUM_INTERVAL_IN_MILLISECONDS;
      expect(wheel(NOTCH)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('keeps showing the pull on a wheel event with no vertical scroll', () => {
      expect(wheel(0)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
      time += NEW_GESTURE_GAP_IN_MILLISECONDS;
      wheel(NOTCH);
      expect(wheel(0)).toMatchObject({ kind: OverscrollUpdateKind.Pull, progress: 1 / 3 });
    });

    it('only says there is nothing further at the first and the last item', () => {
      function hasTarget(action: OverscrollAction): boolean {
        return action === NavigationAction.Previous;
      }
      for (let index = 0; index < 5; index++) {
        time += NOTCH;
        expect(wheel(NOTCH, { hasTarget })).toStrictEqual({ action: NavigationAction.Next, hasTarget: false, isReady: false, kind: OverscrollUpdateKind.Pull, progress: Math.min(1, (index + 1) / 3) });
      }
    });

    it('treats a zero threshold as already passed', () => {
      expect(wheel(NOTCH, { hasTarget: () => false, threshold: 0 })).toMatchObject({ progress: 1 });
    });

    it('swallows the momentum after it opens an item, until a pause', () => {
      wheel(NOTCH, { threshold: NOTCH });
      for (let index = 0; index < 10; index++) {
        time += MOMENTUM_INTERVAL_IN_MILLISECONDS;
        expect(wheel(NOTCH, { isAtBottom: false })).toStrictEqual({ kind: OverscrollUpdateKind.Swallow });
      }
      time += NEW_GESTURE_GAP_IN_MILLISECONDS;
      expect(wheel(NOTCH, { isAtBottom: false })).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });
  });

  describe('with a touch', () => {
    const START_Y = 500;

    it('pulls with a touch that lands at the edge, becomes ready past the threshold, and opens on release', () => {
      gesture.touchStart(touchInput(START_Y));
      expect(gesture.touchMove(touchInput(START_Y - NOTCH))).toStrictEqual({ action: NavigationAction.Next, hasTarget: true, isReady: false, kind: OverscrollUpdateKind.Pull, progress: 1 / 3 });
      expect(gesture.touchMove(touchInput(START_Y - THRESHOLD))).toMatchObject({ isReady: true, progress: 1 });
      expect(gesture.touchEnd(hasAnyTarget, THRESHOLD)).toStrictEqual({ action: NavigationAction.Next, kind: OverscrollUpdateKind.Commit });
    });

    it('pulls down past the top edge to the previous item', () => {
      gesture.touchStart(touchInput(START_Y, { isAtBottom: false, isAtTop: true }));
      expect(gesture.touchMove(touchInput(START_Y + NOTCH))).toMatchObject({ action: NavigationAction.Previous, kind: OverscrollUpdateKind.Pull });
    });

    it('cancels on release short of the threshold', () => {
      gesture.touchStart(touchInput(START_Y));
      gesture.touchMove(touchInput(START_Y - NOTCH));
      expect(gesture.touchEnd(hasAnyTarget, THRESHOLD)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('does not open on release when there is nothing to go to', () => {
      gesture.touchStart(touchInput(START_Y));
      expect(gesture.touchMove(touchInput(START_Y - THRESHOLD, { hasTarget: () => false }))).toMatchObject({ hasTarget: false, isReady: false });
      expect(gesture.touchEnd(() => false, THRESHOLD)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('cancels when the finger turns back, and ignores a touch that did not land at the edge', () => {
      gesture.touchStart(touchInput(START_Y));
      gesture.touchMove(touchInput(START_Y - NOTCH));
      expect(gesture.touchMove(touchInput(START_Y + NOTCH))).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
      expect(gesture.touchMove(touchInput(START_Y))).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
      expect(gesture.touchEnd(hasAnyTarget, THRESHOLD)).toStrictEqual({ kind: OverscrollUpdateKind.Idle });

      gesture.touchStart(touchInput(START_Y, { isAtBottom: false }));
      expect(gesture.touchMove(touchInput(START_Y - THRESHOLD))).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('ignores a move with no touch in progress', () => {
      expect(gesture.touchMove(touchInput(START_Y))).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });

    it('ends the wheel\'s swallowing with a new touch', () => {
      wheel(NOTCH, { threshold: NOTCH });
      gesture.touchStart(touchInput(START_Y));
      time += MOMENTUM_INTERVAL_IN_MILLISECONDS;
      expect(wheel(NOTCH, { isAtBottom: false })).toStrictEqual({ kind: OverscrollUpdateKind.Idle });
    });
  });
});
