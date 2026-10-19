import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FolderMapPopoverAnchor } from './folder-map-popover.ts';

import {
  createFolderMapHeader,
  FOLDER_MAP_TITLE,
  FolderMapPopover
} from './folder-map-popover.ts';

interface Fixture {
  readonly anchorEl: HTMLElement;
  readonly mapEl: HTMLElement;
  readonly onClose: ReturnType<typeof vi.fn>;
  readonly onPin: ReturnType<typeof vi.fn>;
  readonly popover: FolderMapPopover;
  readonly popoverEl: HTMLElement;
}

interface FixtureOptions {
  readonly anchor?: Partial<FolderMapPopoverAnchor>;
  readonly height?: number;
  readonly width?: number;
}

interface Position {
  readonly left: string;
  readonly side: string | undefined;
  readonly top: string;
}

/**
 * The jsdom window's size.
 */
const WINDOW_HEIGHT = 768;
const WINDOW_WIDTH = 1024;

const POPOVER_SELECTOR = '.sibling-notes-folder-map-popover';

function createFixture(options: FixtureOptions = {}): Fixture {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(options.height ?? 200);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(options.width ?? 300);
  const anchorEl = document.body.createEl('button');
  const mapEl = createDiv({ cls: 'map' });
  const onClose = vi.fn();
  const onPin = vi.fn();
  const popover = new FolderMapPopover({
    anchor: {
      bottom: 120,
      doc: document,
      el: anchorEl,
      left: 50,
      top: 100,
      ...options.anchor
    },
    mapEl,
    onClose,
    onPin
  });
  const popoverEl = document.querySelector<HTMLElement>(POPOVER_SELECTOR);
  if (!popoverEl) {
    throw new Error('No popover.');
  }
  return { anchorEl, mapEl, onClose, onPin, popover, popoverEl };
}

function getPosition(el: HTMLElement): Position {
  return { left: el.style.left, side: el.dataset['side'], top: el.style.top };
}

describe('FolderMapPopover', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.empty();
  });

  it('hosts the map under a header with the title and the pin button, styled as a menu', () => {
    const { anchorEl, mapEl, popover, popoverEl } = createFixture();
    expect(popoverEl.parentElement).toBe(document.body);
    expect(popoverEl.hasClass('menu')).toBe(true);
    expect(popoverEl.querySelector('.sibling-notes-folder-map-title')?.textContent).toBe(FOLDER_MAP_TITLE);
    expect(popoverEl.querySelector('.sibling-notes-folder-map-pin')?.getAttribute('aria-label')).toBe('Pin to the side panel');
    expect(popoverEl.lastElementChild).toBe(mapEl);
    expect(popover.anchorEl).toBe(anchorEl);
  });

  it('opens below its anchor when there is room below', () => {
    const { popoverEl } = createFixture();
    expect(getPosition(popoverEl)).toStrictEqual({ left: '50px', side: 'below', top: '124px' });
  });

  it('opens below its anchor whenever it fits there, even with more room above', () => {
    const { popoverEl } = createFixture({ anchor: { bottom: 520, top: 500 }, height: 100 });
    expect(getPosition(popoverEl)).toStrictEqual({ left: '50px', side: 'below', top: '524px' });
  });

  it('opens above its anchor when it does not fit below and there is more room above', () => {
    const { popoverEl } = createFixture({ anchor: { bottom: 720, top: 700 }, height: 400 });
    expect(getPosition(popoverEl)).toStrictEqual({ left: '50px', side: 'above', top: '296px' });
  });

  it('stays below its anchor when it fits neither way but there is less room above', () => {
    const { popoverEl } = createFixture({ anchor: { bottom: 320, top: 300 }, height: 600 });
    expect(getPosition(popoverEl).side).toBe('below');
  });

  it('keeps inside the window, a margin away from its edges', () => {
    const { popoverEl: rightEl } = createFixture({ anchor: { left: 2000 } });
    expect(getPosition(rightEl).left).toBe(`${String(WINDOW_WIDTH - 300 - 8)}px`);
    document.body.empty();
    vi.restoreAllMocks();

    const { popoverEl: leftEl } = createFixture({ anchor: { left: -20 } });
    expect(getPosition(leftEl).left).toBe('8px');
    document.body.empty();
    vi.restoreAllMocks();

    const { popoverEl: tallEl } = createFixture({ height: WINDOW_HEIGHT * 2 });
    expect(getPosition(tallEl).top).toBe('8px');
  });

  it('measures against the global window when its document has no window', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const doc = document.implementation.createHTMLDocument();
    expect(doc.defaultView).toBeNull();
    new FolderMapPopover({
      anchor: { bottom: WINDOW_HEIGHT - 50, doc, el: null, left: 50, top: WINDOW_HEIGHT - 70 },
      mapEl: createDiv(),
      onClose: vi.fn(),
      onPin: vi.fn()
    });
    const popoverEl = doc.querySelector<HTMLElement>(POPOVER_SELECTOR);
    // Below would leave only 50 - 12 pixels of the global window's height, so it opens above.
    expect(popoverEl && getPosition(popoverEl)).toStrictEqual({ left: '50px', side: 'above', top: `${String(WINDOW_HEIGHT - 70 - 4 - 200)}px` });
  });

  it('closes on Escape, swallowing the key', () => {
    const { onClose, popoverEl } = createFixture();
    const keyboardEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' });
    const bubbleListener = vi.fn();
    document.body.addEventListener('keydown', bubbleListener);
    document.body.dispatchEvent(keyboardEvent);
    expect(keyboardEvent.defaultPrevented).toBe(true);
    expect(bubbleListener).not.toHaveBeenCalled();
    expect(popoverEl.isConnected).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open on any other key, which belongs to whatever has focus', () => {
    const { onClose, popoverEl } = createFixture();
    const keyboardEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' });
    document.body.dispatchEvent(keyboardEvent);
    expect(keyboardEvent.defaultPrevented).toBe(false);
    expect(popoverEl.isConnected).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a pointer-down outside it and its anchor', () => {
    const { onClose, popoverEl } = createFixture();
    document.body.createDiv().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(popoverEl.isConnected).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open on a pointer-down inside it, and on its anchor, whose own click closes it instead', () => {
    const { anchorEl, mapEl, onClose, popoverEl } = createFixture();
    mapEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    anchorEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(popoverEl.isConnected).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on any pointer-down outside it when it has no anchor element', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const onClose = vi.fn();
    new FolderMapPopover({
      anchor: { bottom: 120, doc: document, el: null, left: 50, top: 100 },
      mapEl: createDiv(),
      onClose,
      onPin: vi.fn()
    });
    document.body.createDiv().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector(POPOVER_SELECTOR)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes once when its owner closes it, and stops listening', () => {
    const { onClose, popover, popoverEl } = createFixture();
    popover.close();
    popover.close();
    expect(popoverEl.isConnected).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    // A closed popover no longer swallows Escape, which belongs to whatever is under it now.
    const keyboardEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' });
    document.body.dispatchEvent(keyboardEvent);
    expect(keyboardEvent.defaultPrevented).toBe(false);
  });

  it('pins on a click of the pin button', () => {
    const { onPin, popoverEl } = createFixture();
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    popoverEl.querySelector('.sibling-notes-folder-map-pin')?.dispatchEvent(clickEvent);
    expect(onPin).toHaveBeenCalledTimes(1);
    expect(clickEvent.defaultPrevented).toBe(true);
  });
});

describe('createFolderMapHeader', () => {
  it('returns the header it adds to its parent', () => {
    const parentEl = createDiv();
    const headerEl = createFolderMapHeader(parentEl, vi.fn());
    expect(headerEl.parentElement).toBe(parentEl);
    expect(headerEl.hasClass('sibling-notes-folder-map-header')).toBe(true);
    expect(headerEl.querySelector('button')?.getAttribute('type')).toBe('button');
  });
});
