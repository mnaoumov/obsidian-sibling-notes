import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { FOLDER_MAP_TITLE } from './folder-map-popover.ts';
import { FolderMapSheet } from './folder-map-sheet.ts';

interface Fixture {
  readonly mapEl: HTMLElement;
  readonly onClose: ReturnType<typeof vi.fn>;
  readonly onPin: ReturnType<typeof vi.fn>;
  readonly sheet: FolderMapSheet;
}

function createFixture(): Fixture {
  const mapEl = createDiv({ cls: 'map' });
  const onClose = vi.fn();
  const onPin = vi.fn();
  const sheet = new FolderMapSheet({ app: App.createConfigured__().asOriginalType__(), mapEl, onClose, onPin });
  return { mapEl, onClose, onPin, sheet };
}

describe('FolderMapSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a modal restyled as a bottom sheet, opened from no element', () => {
    const { sheet } = createFixture();
    expect(sheet.modalEl.hasClass('sibling-notes-folder-map-sheet')).toBe(true);
    expect(sheet.anchorEl).toBeNull();
  });

  it('shows the map under the header once it opens', () => {
    const { mapEl, sheet } = createFixture();
    expect(sheet.contentEl.childElementCount).toBe(0);
    sheet.open();
    expect(sheet.contentEl.querySelector('.sibling-notes-folder-map-title')?.textContent).toBe(FOLDER_MAP_TITLE);
    expect(sheet.contentEl.lastElementChild).toBe(mapEl);
  });

  it('pins on a click of the pin button', () => {
    const { onPin, sheet } = createFixture();
    sheet.open();
    sheet.contentEl.querySelector('.sibling-notes-folder-map-pin')?.dispatchEvent(new MouseEvent('click', { cancelable: true }));
    expect(onPin).toHaveBeenCalledTimes(1);
  });

  it('tells its owner once it has closed', () => {
    const { onClose, sheet } = createFixture();
    sheet.open();
    expect(onClose).not.toHaveBeenCalled();
    // The mock modal closes itself on the next tick, as a dismissed sheet would.
    vi.runAllTimers();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
