import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { InFolderNavigationAction } from './navigation-action.ts';

import {
  getNavigationTargetIndex,
  NavigationAction
} from './navigation-action.ts';

describe('getNavigationTargetIndex', () => {
  const LENGTH = 25;
  const PAGE_SIZE = 10;

  function getTarget(action: InFolderNavigationAction, currentIndex: number, pageSize = PAGE_SIZE): number | undefined {
    return getNavigationTargetIndex({ action, currentIndex, length: LENGTH, pageSize });
  }

  it('steps one item back and forward', () => {
    expect(getTarget(NavigationAction.Previous, 5)).toBe(4);
    expect(getTarget(NavigationAction.Next, 5)).toBe(6);
  });

  it('goes to the first and the last item', () => {
    expect(getTarget(NavigationAction.Home, 5)).toBe(0);
    expect(getTarget(NavigationAction.End, 5)).toBe(24);
  });

  it('moves a page and stops at the ends', () => {
    expect(getTarget(NavigationAction.PageDown, 5)).toBe(15);
    expect(getTarget(NavigationAction.PageUp, 15)).toBe(5);
    expect(getTarget(NavigationAction.PageDown, 20)).toBe(24);
    expect(getTarget(NavigationAction.PageUp, 3)).toBe(0);
  });

  it('does not wrap around: an action at its end has no target', () => {
    expect(getTarget(NavigationAction.Previous, 0)).toBeUndefined();
    expect(getTarget(NavigationAction.Home, 0)).toBeUndefined();
    expect(getTarget(NavigationAction.PageUp, 0)).toBeUndefined();
    expect(getTarget(NavigationAction.Next, 24)).toBeUndefined();
    expect(getTarget(NavigationAction.End, 24)).toBeUndefined();
    expect(getTarget(NavigationAction.PageDown, 24)).toBeUndefined();
  });

  it('treats a page size below one as one, and drops a fraction', () => {
    expect(getTarget(NavigationAction.PageDown, 5, 0)).toBe(6);
    expect(getTarget(NavigationAction.PageDown, 5, 2.7)).toBe(7);
  });

  it('treats a page size that is not a number as one', () => {
    expect(getTarget(NavigationAction.PageDown, 5, NaN)).toBe(6);
    expect(getTarget(NavigationAction.PageUp, 5, NaN)).toBe(4);
  });

  it('has no target when the current item is not in the sequence', () => {
    expect(getTarget(NavigationAction.Next, -1)).toBeUndefined();
    expect(getNavigationTargetIndex({ action: NavigationAction.Home, currentIndex: 0, length: 0, pageSize: PAGE_SIZE })).toBeUndefined();
  });

  it('rejects an action it does not know', () => {
    expect(() => getTarget(castTo<NavigationAction.Next>(NavigationAction.Up), 5)).toThrow('Unknown navigation action: up');
  });
});
