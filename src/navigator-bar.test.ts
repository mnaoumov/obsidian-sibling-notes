import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { NavigationAction } from './navigation-action.ts';
import {
  NavigatorBar,
  NavigatorBarPlacement
} from './navigator-bar.ts';

function getButton(bar: NavigatorBar, action: string): HTMLButtonElement {
  const button = bar.el.querySelector<HTMLButtonElement>(`button[data-action="${CSS.escape(action)}"]`);
  if (!button) {
    throw new Error(`No ${action} button.`);
  }
  return button;
}

function getButtons(bar: NavigatorBar): HTMLButtonElement[] {
  return [...bar.el.querySelectorAll('button')];
}

describe('NavigatorBar', () => {
  it('lays out its buttons around the position, and marks its placement', () => {
    const bar = new NavigatorBar({ onAction: vi.fn(), placement: NavigatorBarPlacement.Bottom });
    expect(bar.el.dataset['placement']).toBe('bottom');
    expect(getButtons(bar).map((button) => button.dataset['action'])).toStrictEqual([
      'up',
      'home',
      'pageUp',
      'previous',
      'next',
      'pageDown',
      'end',
      'map'
    ]);
    expect(getButton(bar, 'up').textContent).toBe('..');
    expect(getButton(bar, 'map').disabled).toBe(true);
  });

  it('disables the unavailable actions and shows the position', () => {
    const bar = new NavigatorBar({ onAction: vi.fn(), placement: NavigatorBarPlacement.Top });
    bar.update({
      isAvailable: (action) => action !== NavigationAction.Next,
      position: { index: 2, length: 12 }
    });
    expect(getButtons(bar).filter((button) => button.disabled).map((button) => button.dataset['action'])).toStrictEqual(['next', 'map']);
    expect(bar.el.querySelector('.sibling-notes-navigator-bar-position')?.textContent).toBe('3 / 12');

    bar.update({ isAvailable: () => false, position: null });
    expect(bar.el.querySelector('.sibling-notes-navigator-bar-position')?.textContent).toBe('');
  });

  it('reports a click on an enabled button, and ignores a disabled one', () => {
    const onAction = vi.fn();
    const bar = new NavigatorBar({ onAction, placement: NavigatorBarPlacement.Top });
    bar.update({ isAvailable: (action) => action === NavigationAction.Next, position: null });
    getButton(bar, 'previous').dispatchEvent(new MouseEvent('click'));
    getButton(bar, 'next').dispatchEvent(new MouseEvent('click'));
    expect(onAction.mock.calls).toStrictEqual([[NavigationAction.Next]]);
  });
});
