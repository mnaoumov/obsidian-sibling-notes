import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type { OverscrollPull } from './overscroll-gesture.ts';

import { NavigationAction } from '../navigation/navigation-action.ts';
import { OverscrollUpdateKind } from './overscroll-gesture.ts';
import { OverscrollIndicator } from './overscroll-indicator.ts';

function pull(overrides: Partial<OverscrollPull> = {}): OverscrollPull {
  return {
    action: NavigationAction.Next,
    hasTarget: true,
    isReady: false,
    kind: OverscrollUpdateKind.Pull,
    progress: 0.5,
    ...overrides
  };
}

describe('OverscrollIndicator', () => {
  let hostEl: HTMLElement;
  let indicator: OverscrollIndicator;

  beforeEach(() => {
    hostEl = createDiv();
    indicator = new OverscrollIndicator();
  });

  function getLabel(): null | string {
    return indicator.el.querySelector('.sibling-notes-overscroll-indicator-label')?.textContent ?? null;
  }

  it('shows a wheel pull at the bottom edge with its progress and its target', () => {
    indicator.show(hostEl, { isTouch: false, pull: pull(), targetName: 'Chapter 4' });
    expect(indicator.el.parentElement).toBe(hostEl);
    expect(hostEl.hasClass('sibling-notes-overscroll-host')).toBe(true);
    expect(indicator.el.dataset['edge']).toBe('bottom');
    expect(indicator.el.style.getPropertyValue('--sibling-notes-overscroll-progress')).toBe('0.5');
    expect(getLabel()).toBe('Keep scrolling for next: Chapter 4');
  });

  it('shows a touch pull at the top edge, then says to release once it is ready', () => {
    indicator.show(hostEl, { isTouch: true, pull: pull({ action: NavigationAction.Previous }), targetName: 'Chapter 2' });
    expect(indicator.el.dataset['edge']).toBe('top');
    expect(getLabel()).toBe('Keep pulling for previous: Chapter 2');

    indicator.show(hostEl, { isTouch: true, pull: pull({ action: NavigationAction.Previous, isReady: true, progress: 1 }), targetName: 'Chapter 2' });
    expect(indicator.el.hasClass('is-ready')).toBe(true);
    expect(getLabel()).toBe('Release to open previous: Chapter 2');
  });

  it('says there is nothing further at the first and the last item, with an empty fill', () => {
    indicator.show(hostEl, { isTouch: false, pull: pull({ hasTarget: false, progress: 1 }), targetName: null });
    expect(getLabel()).toBe('This is the last item in the folder');
    expect(indicator.el.hasClass('has-no-target')).toBe(true);
    expect(indicator.el.style.getPropertyValue('--sibling-notes-overscroll-progress')).toBe('0');

    indicator.show(hostEl, { isTouch: false, pull: pull({ action: NavigationAction.Previous, hasTarget: false }), targetName: null });
    expect(getLabel()).toBe('This is the first item in the folder');
  });

  it('moves to another view, and leaves no trace when hidden', () => {
    indicator.show(hostEl, { isTouch: false, pull: pull(), targetName: 'a' });
    const otherHostEl = createDiv();
    indicator.show(otherHostEl, { isTouch: false, pull: pull(), targetName: 'a' });
    expect(indicator.el.parentElement).toBe(otherHostEl);
    expect(hostEl.hasClass('sibling-notes-overscroll-host')).toBe(false);

    indicator.hide();
    expect(indicator.el.parentElement).toBeNull();
    expect(otherHostEl.hasClass('sibling-notes-overscroll-host')).toBe(false);
    indicator.hide();
  });
});
