import type {
  TAbstractFile,
  WorkspaceLeaf as WorkspaceLeafOriginal
} from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FolderMapComponent } from './folder-map-component.ts';
import type { FolderMapState } from './folder-map.ts';

import {
  FOLDER_MAP_VIEW_CSS_CLASS,
  FOLDER_MAP_VIEW_TYPE,
  FolderMapView
} from './folder-map-view.ts';
import { NavigationAction } from './navigation-action.ts';

interface Fixture {
  readonly enterFromMap: ReturnType<typeof vi.fn>;
  readonly getState: ReturnType<typeof vi.fn>;
  readonly mainLeaf: WorkspaceLeafOriginal;
  readonly openFromMap: ReturnType<typeof vi.fn>;
  readonly scrollIntoView: ReturnType<typeof vi.fn>;
  setState: (state: FolderMapState | null) => void;
  readonly state: FolderMapState;
  readonly view: FolderMapView;
}

function createFixture(): Fixture {
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('d');
  mockApp.vault.createFolderSync__('d/sub');
  mockApp.vault.createSync__('d/a.md', '');
  mockApp.vault.createSync__('d/b.md', '');
  const app = mockApp.asOriginalType__();

  function getItem(path: string): TAbstractFile {
    const item = app.vault.getAbstractFileByPath(path);
    if (!item) {
      throw new Error(`No ${path}.`);
    }
    return item;
  }

  const folder = app.vault.getFolderByPath('d');
  if (!folder) {
    throw new Error('No d.');
  }

  const state: FolderMapState = {
    currentItem: getItem('d/a.md'),
    folderPath: [folder],
    items: ['d/sub', 'd/a.md', 'd/b.md'].map((path) => getItem(path)),
    rootName: 'Vault',
    targets: new Map([[NavigationAction.Next, getItem('d/b.md')]])
  };
  let currentState: FolderMapState | null = state;
  const getState = vi.fn(() => currentState);
  const enterFromMap = vi.fn();
  const openFromMap = vi.fn();
  const mainLeaf = WorkspaceLeaf.create2__(mockApp).asOriginalType3__();
  vi.spyOn(app.workspace, 'getMostRecentLeaf').mockReturnValue(mainLeaf);

  const scrollIntoView = vi.fn();
  // Jsdom does not lay anything out, so it has no `scrollIntoView` to scroll with.
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });

  const view = new FolderMapView({
    folderMapComponent: strictProxy<FolderMapComponent>({ enterFromMap, getState, openFromMap }),
    leaf: WorkspaceLeaf.create2__(mockApp).asOriginalType3__()
  });
  return {
    enterFromMap,
    getState,
    mainLeaf,
    openFromMap,
    scrollIntoView,
    setState(newState: FolderMapState | null): void {
      currentState = newState;
    },
    state,
    view
  };
}

function getItemEl(view: FolderMapView, path: string): HTMLElement {
  const el = view.contentEl.querySelector<HTMLElement>(`.sibling-notes-folder-map-item[data-path="${CSS.escape(path)}"]`);
  if (!el) {
    throw new Error(`No item for ${path}.`);
  }
  return el;
}

describe('FolderMapView', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('describes itself as the folder map', () => {
    expect(fixture.view.getDisplayText()).toBe('Folder map');
    expect(fixture.view.getIcon()).toBe('map');
    expect(fixture.view.getViewType()).toBe(FOLDER_MAP_VIEW_TYPE);
  });

  it('shows the folder of the main area\'s most recent leaf once it opens, scrolled to the current item', async () => {
    await fixture.view.open(createDiv());
    expect(fixture.view.containerEl.hasClass(FOLDER_MAP_VIEW_CSS_CLASS)).toBe(true);
    expect(fixture.getState).toHaveBeenCalledWith(fixture.mainLeaf);
    expect(Array.from(fixture.view.contentEl.querySelectorAll('.sibling-notes-folder-map-item-name'), (el) => el.textContent)).toStrictEqual(['sub', 'a', 'b']);
    expect(fixture.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(fixture.scrollIntoView.mock.contexts[0]).toBe(getItemEl(fixture.view, 'd/a.md'));
  });

  it('follows the main area on refresh', async () => {
    await fixture.view.open(createDiv());
    fixture.setState(null);
    fixture.view.refresh();
    expect(fixture.view.contentEl.textContent).toBe('Open a note to see its folder.');
  });

  it('opens a clicked file and enters a clicked subfolder in the main area\'s most recent leaf', async () => {
    await fixture.view.open(createDiv());
    const fileClick = new MouseEvent('click');
    getItemEl(fixture.view, 'd/b.md').dispatchEvent(fileClick);
    const folderClick = new MouseEvent('click');
    getItemEl(fixture.view, 'd/sub').dispatchEvent(folderClick);
    expect(fixture.openFromMap).toHaveBeenCalledWith(fixture.state.items[2], fixture.mainLeaf, fileClick);
    expect(fixture.enterFromMap).toHaveBeenCalledWith(fixture.state.items[0], fixture.mainLeaf, folderClick);
  });

  it('marks a hovered button\'s target, and clears the mark', async () => {
    await fixture.view.open(createDiv());
    fixture.view.highlightTarget(fixture.state.targets.get(NavigationAction.Next) ?? null);
    expect(Array.from(fixture.view.contentEl.querySelectorAll<HTMLElement>('.is-targeted'), (el) => el.dataset['path'])).toStrictEqual(['d/b.md']);
    fixture.view.highlightTarget(null);
    expect(fixture.view.contentEl.querySelectorAll('.is-targeted')).toHaveLength(0);
  });
});
