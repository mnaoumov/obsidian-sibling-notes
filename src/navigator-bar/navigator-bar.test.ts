import { addIcon } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { NavigationAction } from '../navigation/navigation-action.ts';
import {
  NavigatorBar,
  NavigatorBarPlacement
} from './navigator-bar.ts';

interface BarFixture {
  readonly bar: NavigatorBar;
  readonly onAction: ReturnType<typeof vi.fn>;
  readonly onHover: ReturnType<typeof vi.fn>;
  readonly onMap: ReturnType<typeof vi.fn>;
}

function createBar(placement: NavigatorBarPlacement): BarFixture {
  const onAction = vi.fn();
  const onHover = vi.fn();
  const onMap = vi.fn();
  return { bar: new NavigatorBar({ onAction, onHover, onMap, placement }), onAction, onHover, onMap };
}

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
    addIcon('folder-up', '<path d="M0 0"/>');
    const { bar } = createBar(NavigatorBarPlacement.Bottom);
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
    expect(getButton(bar, 'up').querySelector('svg')?.classList.contains('folder-up')).toBe(true);
    expect(getButton(bar, 'map').disabled).toBe(false);
  });

  it('disables the unavailable actions and shows the position', () => {
    const { bar } = createBar(NavigatorBarPlacement.Top);
    bar.update({
      isAvailable: (action) => action !== NavigationAction.Next,
      position: { index: 2, length: 12 }
    });
    expect(getButtons(bar).filter((button) => button.disabled).map((button) => button.dataset['action'])).toStrictEqual(['next']);
    expect(bar.el.querySelector('.sibling-notes-navigator-bar-position')?.textContent).toBe('3 / 12');

    bar.update({ isAvailable: () => false, position: null });
    expect(bar.el.querySelector('.sibling-notes-navigator-bar-position')?.textContent).toBe('');
  });

  it('reports a click on an enabled button, and ignores a disabled one', () => {
    const { bar, onAction } = createBar(NavigatorBarPlacement.Top);
    bar.update({ isAvailable: (action) => action === NavigationAction.Next, position: null });
    getButton(bar, 'previous').dispatchEvent(new MouseEvent('click'));
    getButton(bar, 'next').dispatchEvent(new MouseEvent('click'));
    expect(onAction.mock.calls).toStrictEqual([[NavigationAction.Next, false]]);
  });

  it('asks for a new tab on a mod-click or a middle click, and ignores a right click', () => {
    const { bar, onAction } = createBar(NavigatorBarPlacement.Top);
    bar.update({ isAvailable: () => true, position: null });
    const nextButton = getButton(bar, 'next');
    nextButton.dispatchEvent(new MouseEvent('click', { ctrlKey: true, metaKey: true }));
    const middleClick = new MouseEvent('auxclick', { button: 1, cancelable: true });
    getButton(bar, 'up').dispatchEvent(middleClick);
    getButton(bar, 'end').dispatchEvent(new MouseEvent('auxclick', { button: 2 }));
    expect(onAction.mock.calls).toStrictEqual([[NavigationAction.Next, 'tab'], [NavigationAction.Up, 'tab']]);
    expect(middleClick.defaultPrevented).toBe(true);
  });

  it('reports the Map button with the button itself', () => {
    const { bar, onMap } = createBar(NavigatorBarPlacement.Top);
    const mapButton = getButton(bar, 'map');
    mapButton.dispatchEvent(new MouseEvent('click'));
    expect(onMap).toHaveBeenCalledWith(mapButton);
  });

  it('reports a hovered or focused button, and leaving it', () => {
    const { bar, onHover } = createBar(NavigatorBarPlacement.Top);
    const nextButton = getButton(bar, 'next');
    nextButton.dispatchEvent(new MouseEvent('mouseenter'));
    nextButton.dispatchEvent(new MouseEvent('mouseleave'));
    nextButton.dispatchEvent(new FocusEvent('focus'));
    nextButton.dispatchEvent(new FocusEvent('blur'));
    expect(onHover.mock.calls).toStrictEqual([[NavigationAction.Next], [null], [NavigationAction.Next], [null]]);
  });
});
