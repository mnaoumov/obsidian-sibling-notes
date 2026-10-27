import { NavigationAction } from '../navigation/navigation-action.ts';

/**
 * What the gesture asks of its caller after an input.
 */
export enum OverscrollUpdateKind {
  /**
   * Open the target now.
   */
  Commit = 'commit',

  /**
   * Show nothing: there is no pull.
   */
  Idle = 'idle',

  /**
   * Show the pull's progress.
   */
  Pull = 'pull',

  /**
   * Keep this wheel event from scrolling: it is the momentum tail of a pull that has just opened an item, and
   * would otherwise scroll the item it landed on.
   */
  Swallow = 'swallow'
}

/**
 * The two moves a pull past an edge makes: past the bottom to the next item, past the top to the previous one.
 */
export type OverscrollAction = NavigationAction.Next | NavigationAction.Previous;

/**
 * A pull that has gone far enough: open its target.
 */
export interface OverscrollCommit {
  readonly action: OverscrollAction;
  readonly kind: OverscrollUpdateKind.Commit;
}

/**
 * No pull to show, or a wheel event to swallow.
 */
export interface OverscrollIdle {
  readonly kind: OverscrollUpdateKind.Idle | OverscrollUpdateKind.Swallow;
}

/**
 * A pull in progress.
 */
export interface OverscrollPull {
  readonly action: OverscrollAction;

  /**
   * Whether there is an item to go to. At the first and the last item there is not, and the pull only says so.
   */
  readonly hasTarget: boolean;

  /**
   * Whether lifting the finger opens the target. Only a touch pull is ever ready: a wheel pull opens as soon as it
   * is long enough, because a wheel has no release.
   */
  readonly isReady: boolean;
  readonly kind: OverscrollUpdateKind.Pull;

  /**
   * How far the pull has gone, from 0 to 1.
   */
  readonly progress: number;
}

/**
 * A touch start or move.
 */
export interface OverscrollTouchInput extends OverscrollInputBase {
  /**
   * The finger's vertical position, in pixels.
   */
  readonly y: number;
}

/**
 * What the gesture asks of its caller after an input.
 */
export type OverscrollUpdate = OverscrollCommit | OverscrollIdle | OverscrollPull;

/**
 * A wheel event.
 */
export interface OverscrollWheelInput extends OverscrollInputBase {
  /**
   * The vertical scroll, in pixels. Positive scrolls down.
   */
  readonly delta: number;

  /**
   * When the event arrived, in milliseconds.
   */
  readonly time: number;
}

/**
 * Where the scroller stands, and what a pull would reach, when an input arrives.
 */
interface OverscrollInputBase {
  /**
   * Whether there is an item for an action to go to.
   */
  readonly hasTarget: (action: OverscrollAction) => boolean;

  /**
   * Whether the scroller is at its bottom edge and that edge pulls.
   */
  readonly isAtBottom: boolean;

  /**
   * Whether the scroller is at its top edge and that edge pulls.
   */
  readonly isAtTop: boolean;

  /**
   * How far a pull goes before it opens its target, in pixels.
   */
  readonly threshold: number;
}

/**
 * The shortest pause in wheel events that counts as a new gesture. Momentum scrolling sends events closer than
 * this, so a fling that reaches the edge never starts a pull.
 */
export const NEW_GESTURE_GAP_IN_MILLISECONDS = 250;

/**
 * How long a pull may pause before it is cancelled.
 */
export const PULL_PAUSE_IN_MILLISECONDS = 600;

interface PullState {
  readonly action: OverscrollAction;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Each wheel event accumulates distance into the active pull.
  distance: number;
}

interface TouchState {
  readonly isAtBottom: boolean;
  readonly isAtTop: boolean;
  readonly startY: number;
}

const IDLE: OverscrollUpdate = { kind: OverscrollUpdateKind.Idle };

/**
 * The pull past a note's edge, as a state machine over wheel and touch input.
 *
 * Scrolling that reaches an edge does nothing more. A new gesture there, after a pause in the wheel events or with
 * a new touch, starts a pull, which grows with further scrolling in the same direction. Scrolling back, or pausing,
 * cancels it. A wheel pull opens its target once it passes the threshold. A touch pull past the threshold is ready,
 * and opens its target when the finger lifts.
 */
export class OverscrollGesture {
  private isSwallowing = false;
  private lastWheelTime = -Infinity;
  private pull: null | PullState = null;
  private touch: null | TouchState = null;

  /**
   * Drops the pull in progress, if any: the caller saw a pause, or a scroll it does not count.
   */
  public cancel(): void {
    this.pull = null;
  }

  /**
   * Handles the end of a touch.
   *
   * @param hasTarget - Whether there is an item for an action to go to.
   * @param threshold - How far a pull goes before it is ready, in pixels.
   * @returns A commit when the pull was ready, else idle.
   */
  public touchEnd(hasTarget: (action: OverscrollAction) => boolean, threshold: number): OverscrollUpdate {
    const { pull } = this;
    this.pull = null;
    this.touch = null;
    return pull && pull.distance >= threshold && hasTarget(pull.action) ? { action: pull.action, kind: OverscrollUpdateKind.Commit } : IDLE;
  }

  /**
   * Handles a finger moving.
   *
   * @param input - The finger's position and the scroller's state.
   * @returns The pull, or idle.
   */
  public touchMove(input: OverscrollTouchInput): OverscrollUpdate {
    const { touch } = this;
    if (!touch) {
      return IDLE;
    }
    const offset = touch.startY - input.y;
    const action = offset > 0 ? NavigationAction.Next : NavigationAction.Previous;
    // Only an edge the scroller stood at when the finger landed pulls: a touch that scrolls to the edge is the
    // Touch's momentum, and a new touch is the new gesture.
    const isAtEdge = action === NavigationAction.Next ? touch.isAtBottom : touch.isAtTop;
    if (offset === 0 || !isAtEdge) {
      this.pull = null;
      return IDLE;
    }
    this.pull = { action, distance: Math.abs(offset) };
    return this.getPullUpdate(this.pull, input, true);
  }

  /**
   * Handles a finger landing.
   *
   * @param input - The finger's position and the scroller's state.
   */
  public touchStart(input: Pick<OverscrollTouchInput, 'isAtBottom' | 'isAtTop' | 'y'>): void {
    this.pull = null;
    this.isSwallowing = false;
    this.touch = { isAtBottom: input.isAtBottom, isAtTop: input.isAtTop, startY: input.y };
  }

  /**
   * Handles a wheel event.
   *
   * @param input - The event's scroll and time, and the scroller's state.
   * @returns What to show or do.
   */
  public wheel(input: OverscrollWheelInput): OverscrollUpdate {
    const gap = input.time - this.lastWheelTime;
    this.lastWheelTime = input.time;

    if (this.isSwallowing) {
      if (gap < NEW_GESTURE_GAP_IN_MILLISECONDS) {
        return { kind: OverscrollUpdateKind.Swallow };
      }
      this.isSwallowing = false;
    }

    if (input.delta === 0) {
      return this.pull ? this.getPullUpdate(this.pull, input, false) : IDLE;
    }

    const action = input.delta > 0 ? NavigationAction.Next : NavigationAction.Previous;
    const isAtEdge = action === NavigationAction.Next ? input.isAtBottom : input.isAtTop;
    if (!isAtEdge || (this.pull && this.pull.action !== action)) {
      this.pull = null;
      return IDLE;
    }

    if (this.pull && gap < PULL_PAUSE_IN_MILLISECONDS) {
      this.pull.distance += Math.abs(input.delta);
    } else if (gap >= NEW_GESTURE_GAP_IN_MILLISECONDS) {
      this.pull = { action, distance: Math.abs(input.delta) };
    } else {
      // The momentum of the scroll that reached the edge.
      this.pull = null;
      return IDLE;
    }

    if (this.pull.distance >= input.threshold && input.hasTarget(action)) {
      this.pull = null;
      this.isSwallowing = true;
      return { action, kind: OverscrollUpdateKind.Commit };
    }
    return this.getPullUpdate(this.pull, input, false);
  }

  private getPullUpdate(pull: PullState, input: OverscrollInputBase, isTouch: boolean): OverscrollPull {
    const progress = input.threshold > 0 ? Math.min(1, pull.distance / input.threshold) : 1;
    const hasTarget = input.hasTarget(pull.action);
    return {
      action: pull.action,
      hasTarget,
      isReady: isTouch && hasTarget && progress >= 1,
      kind: OverscrollUpdateKind.Pull,
      progress
    };
  }
}
