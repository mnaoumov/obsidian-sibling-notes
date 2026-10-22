import type {
  TAbstractFile,
  TFolder
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { addIcon } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FolderMapState } from './folder-map.ts';

import { FolderMap } from './folder-map.ts';
import { NavigationAction } from './navigation-action.ts';

interface Fixture {
  readonly map: FolderMap;
  readonly onEnter: ReturnType<typeof vi.fn>;
  readonly onOpen: ReturnType<typeof vi.fn>;
  readonly state: FolderMapState;
}

function createFixture(): Fixture {
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('a');
  mockApp.vault.createFolderSync__('a/b');
  mockApp.vault.createFolderSync__('a/b/sub');
  for (const name of ['x.md', 'y.md', 'z.png']) {
    mockApp.vault.createSync__(`a/b/${name}`, '');
  }
  const app = mockApp.asOriginalType__();

  function getItem(path: string): TAbstractFile {
    const item = app.vault.getAbstractFileByPath(path);
    if (!item) {
      throw new Error(`No ${path}.`);
    }
    return item;
  }

  function getFolder(path: string): TFolder {
    const folder = app.vault.getFolderByPath(path);
    if (!folder) {
      throw new Error(`No ${path}.`);
    }
    return folder;
  }

  const onEnter = vi.fn();
  const onOpen = vi.fn();
  const state: FolderMapState = {
    currentItem: getItem('a/b/y.md'),
    folderPath: [getFolder('a'), getFolder('a/b')],
    items: ['a/b/sub', 'a/b/x.md', 'a/b/y.md', 'a/b/z.png'].map((path) => getItem(path)),
    rootName: 'Vault',
    targets: new Map([
      [NavigationAction.End, getItem('a/b/z.png')],
      [NavigationAction.Home, getItem('a/b/sub')],
      [NavigationAction.Next, getItem('a/b/z.png')],
      [NavigationAction.Previous, getItem('a/b/x.md')],
      [NavigationAction.Up, getItem('a/b')]
    ])
  };
  return { map: new FolderMap({ onEnter, onOpen }), onEnter, onOpen, state };
}

function getByPath(map: FolderMap, selector: string, path: string): HTMLElement {
  const el = map.el.querySelector<HTMLElement>(`${selector}[data-path="${CSS.escape(path)}"]`);
  if (!el) {
    throw new Error(`No ${selector} for ${path}.`);
  }
  return el;
}

function getTargetActions(el: Element | null): string[] {
  return el ? Array.from(el.querySelectorAll<HTMLElement>('.sibling-notes-folder-map-target'), (targetEl) => targetEl.dataset['action'] ?? '') : [];
}

describe('FolderMap', () => {
  it('shows the breadcrumbs and the items in order, and highlights the current item', () => {
    const { map, state } = createFixture();
    map.update(state);
    expect(Array.from(map.el.querySelectorAll(':scope .sibling-notes-folder-map-breadcrumbs > *'), (el) => el.firstChild?.textContent)).toStrictEqual([
      'Vault',
      '/',
      'a',
      '/',
      'b'
    ]);
    expect(Array.from(map.el.querySelectorAll('.sibling-notes-folder-map-item-name'), (el) => el.textContent)).toStrictEqual(['sub', 'x', 'y', 'z.png']);
    expect(Array.from(map.el.querySelectorAll<HTMLElement>('.sibling-notes-folder-map-item.is-active'), (el) => el.dataset['path'])).toStrictEqual(['a/b/y.md']);
  });

  it('puts each button\'s icon on the item it reaches, and Up\'s on the folder\'s own breadcrumb', () => {
    addIcon('folder-up', '<path d="M0 0"/>');
    const { map, state } = createFixture();
    map.update(state);
    expect(getTargetActions(getByPath(map, '.sibling-notes-folder-map-item', 'a/b/sub'))).toStrictEqual(['home']);
    expect(getTargetActions(getByPath(map, '.sibling-notes-folder-map-item', 'a/b/x.md'))).toStrictEqual(['previous']);
    expect(getTargetActions(getByPath(map, '.sibling-notes-folder-map-item', 'a/b/y.md'))).toStrictEqual([]);
    expect(getTargetActions(getByPath(map, '.sibling-notes-folder-map-item', 'a/b/z.png'))).toStrictEqual(['next', 'end']);
    const upTarget = getByPath(map, '.sibling-notes-folder-map-breadcrumb', 'a/b');
    expect(getTargetActions(upTarget)).toStrictEqual(['up']);
    expect(upTarget.querySelector(':scope .sibling-notes-folder-map-target svg')?.classList.contains('folder-up')).toBe(true);
  });

  it('highlights a hovered button\'s target, across updates, and clears it', () => {
    const { map, state } = createFixture();
    map.update(state);
    const target = state.targets.get(NavigationAction.Next) ?? null;
    map.highlightTarget(target);
    expect(Array.from(map.el.querySelectorAll<HTMLElement>('.is-targeted'), (el) => el.dataset['path'])).toStrictEqual(['a/b/z.png']);
    map.update(state);
    expect(map.el.querySelectorAll('.is-targeted')).toHaveLength(1);
    map.highlightTarget(null);
    expect(map.el.querySelectorAll('.is-targeted')).toHaveLength(0);
  });

  it('opens a file or a breadcrumb folder, and enters a subfolder', () => {
    const { map, onEnter, onOpen, state } = createFixture();
    map.update(state);
    getByPath(map, '.sibling-notes-folder-map-item', 'a/b/x.md').dispatchEvent(new MouseEvent('click'));
    getByPath(map, '.sibling-notes-folder-map-breadcrumb', 'a').dispatchEvent(new MouseEvent('auxclick', { button: 1 }));
    getByPath(map, '.sibling-notes-folder-map-item', 'a/b/sub').dispatchEvent(new MouseEvent('click'));
    getByPath(map, '.sibling-notes-folder-map-item', 'a/b/z.png').dispatchEvent(new MouseEvent('auxclick', { button: 2 }));
    expect(onOpen.mock.calls.map((call) => castTo<TAbstractFile>(call[0]).path)).toStrictEqual(['a/b/x.md', 'a']);
    expect(onEnter.mock.calls.map((call) => castTo<TAbstractFile>(call[0]).path)).toStrictEqual(['a/b/sub']);
  });

  it('scrolls the current item into view, and nothing when no item is current', () => {
    const { map, state } = createFixture();
    map.update(state);
    const activeEl = getByPath(map, '.sibling-notes-folder-map-item', 'a/b/y.md');
    // Jsdom does not lay anything out, so it has no `scrollIntoView` to scroll with.
    const scrollIntoView = vi.fn();
    activeEl.scrollIntoView = scrollIntoView;
    map.scrollToCurrent();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    map.update(null);
    expect(() => {
      map.scrollToCurrent();
    }).not.toThrow();
  });

  it('says so when there is nothing to show, or the folder is empty', () => {
    const { map, state } = createFixture();
    map.update(null);
    expect(map.el.textContent).toBe('Open a note to see its folder.');
    map.update({ ...state, items: [], targets: new Map() });
    expect(map.el.querySelector('.sibling-notes-folder-map-items')?.textContent).toBe('This folder is empty.');
  });
});
