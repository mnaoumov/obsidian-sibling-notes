import type {
  App as AppOriginal,
  TAbstractFile,
  TFolder,
  WorkspaceLeaf
} from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  FileView,
  Platform
} from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FolderMapPopoverAnchor } from './folder-map-popover.ts';

import { FolderMapComponent } from './folder-map-component.ts';
import {
  FOLDER_MAP_VIEW_TYPE,
  FolderMapView
} from './folder-map-view.ts';
import { NavigationAction } from './navigation-action.ts';
import {
  NavigatorBar,
  NavigatorBarPlacement
} from './navigator-bar.ts';
import { SiblingNavigator } from './sibling-navigator.ts';
import { VirtualFolderNoteView } from './virtual-folder-note-view.ts';

interface FakePopoverParams {
  readonly anchor: FolderMapPopoverAnchor;
  readonly mapEl: HTMLElement;
  readonly onClose: () => void;
  readonly onPin: () => void;
}

interface FakeSheetParams {
  readonly app: AppOriginal;
  readonly mapEl: HTMLElement;
  readonly onClose: () => void;
  readonly onPin: () => void;
}

const { FakePopover, FakeSheet } = vi.hoisted(() => {
  /**
   * Stands in for the popover: it records how it was opened, and closes as the real one does, by calling
   * its `onClose`.
   */
  class FakePopoverImpl {
    public static readonly instances: FakePopoverImpl[] = [];
    public readonly params: FakePopoverParams;

    public readonly close = vi.fn((): void => {
      this.params.onClose();
    });

    public get anchorEl(): HTMLElement | null {
      return this.params.anchor.el;
    }

    public constructor(params: FakePopoverParams) {
      this.params = params;
      FakePopoverImpl.instances.push(this);
    }
  }

  /**
   * Stands in for the bottom sheet, the same way.
   */
  class FakeSheetImpl {
    public static readonly instances: FakeSheetImpl[] = [];
    public readonly params: FakeSheetParams;

    public readonly close = vi.fn((): void => {
      this.params.onClose();
    });

    public readonly open = vi.fn();

    public constructor(params: FakeSheetParams) {
      this.params = params;
      FakeSheetImpl.instances.push(this);
    }
  }

  return { FakePopover: FakePopoverImpl, FakeSheet: FakeSheetImpl };
});

vi.mock('./folder-map-popover.ts', () => ({ FolderMapPopover: FakePopover }));
vi.mock('./folder-map-sheet.ts', () => ({ FolderMapSheet: FakeSheet }));

interface FakeLeaf {
  readonly leaf: WorkspaceLeaf;
  readonly openFile: ReturnType<typeof vi.fn>;
  readonly setViewState: ReturnType<typeof vi.fn>;
}

interface FakeView {
  readonly highlightTarget: ReturnType<typeof vi.fn>;
  readonly refresh: ReturnType<typeof vi.fn>;
  readonly view: FolderMapView;
}

interface Fixture {
  readonly app: AppOriginal;
  readonly component: FolderMapComponent;
  readonly getRightLeaf: ReturnType<typeof vi.fn>;
  readonly newTabLeaf: FakeLeaf;
  readonly pinnedLeaves: WorkspaceLeaf[];
  readonly revealLeaf: ReturnType<typeof vi.fn>;
}

const PAGE_SIZE = 10;
const RECT = { bottom: 140, height: 40, left: 10, right: 310, top: 100, width: 300 };

/**
 * A leaf showing a note, with a top and a bottom navigator bar in its view, as the navigator bar component
 * puts them there.
 */
interface NoteLeaf extends FakeLeaf {
  readonly bottomButton: HTMLElement;
  readonly containerEl: HTMLElement;
  readonly topButton: HTMLElement;
}

function createFakeLeaf(view: unknown): FakeLeaf {
  const openFile = vi.fn(() => noopAsync());
  const setViewState = vi.fn(() => noopAsync());
  return { leaf: castTo<WorkspaceLeaf>({ openFile, setViewState, view }), openFile, setViewState };
}

function createFakeView(): FakeView {
  const view = castTo<FolderMapView>(Object.create(FolderMapView.prototype));
  const highlightTarget = vi.fn();
  const refresh = vi.fn();
  Object.assign(view, { highlightTarget, refresh });
  return { highlightTarget, refresh, view };
}

function createFixture(): Fixture {
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('d');
  mockApp.vault.createFolderSync__('d/sub');
  mockApp.vault.createSync__('d/sub/x.md', '');
  for (const name of ['a', 'b', 'c']) {
    mockApp.vault.createSync__(`d/${name}.md`, '');
  }
  mockApp.vault.createSync__('top.md', '');
  const app = mockApp.asOriginalType__();

  const pinnedLeaves: WorkspaceLeaf[] = [];
  vi.spyOn(app.workspace, 'getLeavesOfType').mockImplementation((type) => type === FOLDER_MAP_VIEW_TYPE ? pinnedLeaves : []);
  const revealLeaf = vi.fn(() => noopAsync());
  vi.spyOn(app.workspace, 'revealLeaf').mockImplementation(revealLeaf);
  const getRightLeaf = vi.fn((): null | WorkspaceLeaf => null);
  vi.spyOn(app.workspace, 'getRightLeaf').mockImplementation(getRightLeaf);
  const newTabLeaf = createFakeLeaf(null);
  vi.spyOn(app.workspace, 'getLeaf').mockReturnValue(newTabLeaf.leaf);

  const siblingNavigator = new SiblingNavigator({ app, getPageSize: (): number => PAGE_SIZE });
  const component = new FolderMapComponent({ app, siblingNavigator });
  component.load();
  return { app, component, getRightLeaf, newTabLeaf, pinnedLeaves, revealLeaf };
}

function createNoteLeaf(app: AppOriginal, path: string): NoteLeaf {
  const fileView = castTo<FileView>(Object.create(FileView.prototype));
  fileView.file = app.vault.getFileByPath(path);
  const containerEl = createDiv();
  Object.assign(fileView, { containerEl });
  const bars = [NavigatorBarPlacement.Top, NavigatorBarPlacement.Bottom].map((placement) => {
    const bar = new NavigatorBar({ onAction: vi.fn(), onHover: vi.fn(), onMap: vi.fn(), placement });
    containerEl.append(bar.el);
    return bar;
  });
  const [topBar, bottomBar] = bars;
  if (!topBar || !bottomBar) {
    throw new Error('No bars.');
  }
  return { ...createFakeLeaf(fileView), bottomButton: getMapButton(bottomBar), containerEl, topButton: getMapButton(topBar) };
}

function getItem(app: AppOriginal, path: string): TAbstractFile {
  const item = app.vault.getAbstractFileByPath(path);
  if (!item) {
    throw new Error(`No ${path}.`);
  }
  return item;
}

function getItemEl(mapEl: HTMLElement, path: string): HTMLElement {
  const el = mapEl.querySelector<HTMLElement>(`.sibling-notes-folder-map-item[data-path="${CSS.escape(path)}"]`);
  if (!el) {
    throw new Error(`No item for ${path}.`);
  }
  return el;
}

function getLastPopover(): InstanceType<typeof FakePopover> {
  const popover = FakePopover.instances.at(-1);
  if (!popover) {
    throw new Error('No popover.');
  }
  return popover;
}

function getMapButton(bar: NavigatorBar): HTMLElement {
  const button = bar.el.querySelector<HTMLElement>('button[data-action="map"]');
  if (!button) {
    throw new Error('No Map button.');
  }
  return button;
}

function getPaths(mapEl: HTMLElement, selector: string): (string | undefined)[] {
  return Array.from(mapEl.querySelectorAll<HTMLElement>(selector), (el) => el.dataset['path']);
}

describe('FolderMapComponent', () => {
  let fixture: Fixture;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakePopover.instances.length = 0;
    FakeSheet.instances.length = 0;
    // The test DOM has no layout, so it has no `scrollIntoView` either.
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView, writable: true });
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.component.unload();
    Platform.isMobile = false;
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  describe('getState', () => {
    it('describes the leaf\'s folder: breadcrumbs, items in order, and where every bar button lands', () => {
      vi.spyOn(fixture.app.vault, 'getName').mockReturnValue('My vault');
      const { leaf } = createNoteLeaf(fixture.app, 'd/b.md');
      const state = fixture.component.getState(leaf);
      expect(state?.currentItem.path).toBe('d/b.md');
      expect(state?.folderPath.map((folder) => folder.path)).toStrictEqual(['d']);
      expect(state?.items.map((item) => item.path)).toStrictEqual(['d/sub', 'd/a.md', 'd/b.md', 'd/c.md']);
      expect(state?.rootName).toBe('My vault');
      expect(Object.fromEntries([...state?.targets ?? []].map(([action, target]) => [action, target.path]))).toStrictEqual({
        [NavigationAction.End]: 'd/c.md',
        [NavigationAction.Home]: 'd/sub',
        [NavigationAction.Next]: 'd/c.md',
        [NavigationAction.PageDown]: 'd/c.md',
        [NavigationAction.PageUp]: 'd/sub',
        [NavigationAction.Previous]: 'd/a.md',
        [NavigationAction.Up]: 'd'
      });
    });

    it('has no breadcrumbs below the vault and no Up target for a root-level note, since nothing is above the vault', () => {
      const { leaf } = createNoteLeaf(fixture.app, 'top.md');
      const state = fixture.component.getState(leaf);
      expect(state?.folderPath).toStrictEqual([]);
      expect(state?.targets.has(NavigationAction.Up)).toBe(false);
      expect(state?.targets.get(NavigationAction.Previous)?.path).toBe('d');
    });

    it('has nothing to show without a leaf, for a view that shows no item, or for the vault root itself, which is in no folder', () => {
      expect(fixture.component.getState(null)).toBeNull();
      expect(fixture.component.getState(createFakeLeaf({}).leaf)).toBeNull();

      const rootView = castTo<VirtualFolderNoteView>(Object.create(VirtualFolderNoteView.prototype));
      Object.defineProperty(rootView, 'folder', { value: fixture.app.vault.getRoot() });
      expect(fixture.component.getState(createFakeLeaf(rootView).leaf)).toBeNull();
    });
  });

  describe('show', () => {
    it('opens a popover on desktop below the Map button it was shown from, holding the leaf\'s map scrolled to the current item', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      vi.spyOn(noteLeaf.topButton, 'getBoundingClientRect').mockReturnValue(castTo<DOMRect>(RECT));
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);

      expect(FakeSheet.instances).toHaveLength(0);
      const popover = getLastPopover();
      expect(popover.params.anchor).toStrictEqual({ bottom: RECT.bottom, doc: document, el: noteLeaf.topButton, left: RECT.left, top: RECT.top });
      expect(getPaths(popover.params.mapEl, '.sibling-notes-folder-map-item.is-active')).toStrictEqual(['d/b.md']);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(getItemEl(popover.params.mapEl, 'd/b.md'));
    });

    it('closes the popover when shown again from the same Map button, and moves it when shown from another', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');

      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const first = getLastPopover();
      await fixture.component.show(noteLeaf.leaf, noteLeaf.bottomButton);
      expect(first.close).toHaveBeenCalledTimes(1);
      const second = getLastPopover();
      expect(second.anchorEl).toBe(noteLeaf.bottomButton);

      await fixture.component.show(noteLeaf.leaf, noteLeaf.bottomButton);
      expect(second.close).toHaveBeenCalledTimes(1);
      expect(FakePopover.instances).toHaveLength(2);
    });

    it('opens the popover from the leaf\'s shown Map button when the command shows it', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      vi.spyOn(noteLeaf.bottomButton, 'isShown').mockReturnValue(true);

      await fixture.component.show(noteLeaf.leaf, null);
      expect(getLastPopover().anchorEl).toBe(noteLeaf.bottomButton);
    });

    it('opens the popover at the middle of the leaf\'s top when no bar of the leaf is shown, and the command opens a new one each time', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      vi.spyOn(noteLeaf.containerEl, 'getBoundingClientRect').mockReturnValue(castTo<DOMRect>(RECT));

      await fixture.component.show(noteLeaf.leaf, null);
      const first = getLastPopover();
      expect(first.params.anchor).toStrictEqual({ bottom: RECT.top, doc: document, el: null, left: RECT.left + RECT.width / 2, top: RECT.top });

      await fixture.component.show(noteLeaf.leaf, null);
      expect(first.close).toHaveBeenCalledTimes(1);
      expect(FakePopover.instances).toHaveLength(2);
    });

    it('opens a bottom sheet on mobile, which opens anew from the same Map button since a sheet covers it', async () => {
      Platform.isMobile = true;
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');

      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      expect(FakePopover.instances).toHaveLength(0);
      const [first] = FakeSheet.instances;
      expect(first?.params.app).toBe(fixture.app);
      expect(first?.open).toHaveBeenCalledTimes(1);
      expect(getPaths(first?.params.mapEl ?? createDiv(), '.sibling-notes-folder-map-item.is-active')).toStrictEqual(['d/b.md']);

      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      expect(first?.close).toHaveBeenCalledTimes(1);
      expect(FakeSheet.instances).toHaveLength(2);
      expect(FakeSheet.instances[1]?.open).toHaveBeenCalledTimes(1);
    });

    it('reveals the pinned map instead of opening another, and closes an open popover', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const popover = getLastPopover();
      const pinnedLeaf = createFakeLeaf(createFakeView().view).leaf;
      fixture.pinnedLeaves.push(pinnedLeaf);

      await fixture.component.show(noteLeaf.leaf, noteLeaf.bottomButton);
      expect(popover.close).toHaveBeenCalledTimes(1);
      expect(fixture.revealLeaf).toHaveBeenCalledWith(pinnedLeaf);
      expect(FakePopover.instances).toHaveLength(1);
    });

    it('forgets a popover that closed itself, so its Map button opens it again rather than toggling it', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      getLastPopover().params.onClose();

      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      expect(FakePopover.instances).toHaveLength(2);
    });

    it('keeps the open popover when an earlier, replaced popover reports its close late', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const first = getLastPopover();
      await fixture.component.show(noteLeaf.leaf, noteLeaf.bottomButton);
      const second = getLastPopover();

      first.params.onClose();
      await fixture.component.show(noteLeaf.leaf, noteLeaf.bottomButton);
      expect(second.close).toHaveBeenCalledTimes(1);
      expect(FakePopover.instances).toHaveLength(2);
    });

    it('pins the map from the popover\'s pin button', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const popover = getLastPopover();
      const rightLeaf = createFakeLeaf(null);
      fixture.getRightLeaf.mockReturnValue(rightLeaf.leaf);

      popover.params.onPin();
      await vi.waitFor(() => {
        expect(fixture.revealLeaf).toHaveBeenCalledWith(rightLeaf.leaf);
      });
      expect(popover.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('pin', () => {
    it('opens the map in the right side panel without focusing it, and reveals it', async () => {
      const rightLeaf = createFakeLeaf(null);
      fixture.getRightLeaf.mockReturnValue(rightLeaf.leaf);

      await fixture.component.pin();
      expect(fixture.getRightLeaf).toHaveBeenCalledWith(false);
      expect(rightLeaf.setViewState).toHaveBeenCalledWith({ active: false, type: FOLDER_MAP_VIEW_TYPE });
      expect(fixture.revealLeaf).toHaveBeenCalledWith(rightLeaf.leaf);
    });

    it('reveals the already pinned map rather than opening a second one', async () => {
      const pinnedLeaf = createFakeLeaf(createFakeView().view).leaf;
      fixture.pinnedLeaves.push(pinnedLeaf);

      await fixture.component.pin();
      expect(fixture.getRightLeaf).not.toHaveBeenCalled();
      expect(fixture.revealLeaf).toHaveBeenCalledWith(pinnedLeaf);
    });

    it('reveals nothing when the workspace has no right side panel to open it in', async () => {
      await fixture.component.pin();
      expect(fixture.revealLeaf).not.toHaveBeenCalled();
    });
  });

  describe('highlightTarget', () => {
    it('marks a hovered button\'s target in the popover and in every pinned map, and clears it when the button is left', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const { mapEl } = getLastPopover().params;
      const pinned = createFakeView();
      fixture.pinnedLeaves.push(createFakeLeaf(pinned.view).leaf, createFakeLeaf({}).leaf);
      const b = getItem(fixture.app, 'd/b.md');

      fixture.component.highlightTarget(NavigationAction.Next, b);
      expect(getPaths(mapEl, '.is-targeted')).toStrictEqual(['d/c.md']);
      expect(pinned.highlightTarget).toHaveBeenCalledWith(getItem(fixture.app, 'd/c.md'));

      fixture.component.highlightTarget(null, b);
      expect(getPaths(mapEl, '.is-targeted')).toStrictEqual([]);
      expect(pinned.highlightTarget).toHaveBeenLastCalledWith(null);
    });

    it('marks the target in the pinned maps when no popover is open', () => {
      const pinned = createFakeView();
      fixture.pinnedLeaves.push(createFakeLeaf(pinned.view).leaf);
      fixture.component.highlightTarget(NavigationAction.Previous, getItem(fixture.app, 'd/b.md'));
      expect(pinned.highlightTarget).toHaveBeenCalledWith(getItem(fixture.app, 'd/a.md'));
    });
  });

  describe('refresh', () => {
    it('shows the folder as it is now in the popover, and refreshes every pinned map', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const { mapEl } = getLastPopover().params;
      const pinned = createFakeView();
      fixture.pinnedLeaves.push(createFakeLeaf(pinned.view).leaf);

      await fixture.app.vault.create('d/bb.md', '');
      fixture.component.refresh();
      expect(getPaths(mapEl, '.sibling-notes-folder-map-item')).toStrictEqual(['d/sub', 'd/a.md', 'd/b.md', 'd/bb.md', 'd/c.md']);
      expect(pinned.refresh).toHaveBeenCalledTimes(1);
    });

    it('refreshes the pinned maps when no popover is open', () => {
      const pinned = createFakeView();
      fixture.pinnedLeaves.push(createFakeLeaf(pinned.view).leaf);
      fixture.component.refresh();
      expect(pinned.refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('clicks in the map', () => {
    it('opens a clicked note in the map\'s leaf and closes the popover', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const popover = getLastPopover();

      getItemEl(popover.params.mapEl, 'd/c.md').dispatchEvent(new MouseEvent('click'));
      await vi.waitFor(() => {
        expect(noteLeaf.openFile).toHaveBeenCalledWith(getItem(fixture.app, 'd/c.md'));
      });
      expect(popover.close).toHaveBeenCalledTimes(1);
      expect(fixture.newTabLeaf.openFile).not.toHaveBeenCalled();
    });

    it('opens a mod-clicked note in a new tab, as a link would', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);

      getItemEl(getLastPopover().params.mapEl, 'd/a.md').dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
      await vi.waitFor(() => {
        expect(fixture.newTabLeaf.openFile).toHaveBeenCalledWith(getItem(fixture.app, 'd/a.md'));
      });
      expect(vi.mocked(fixture.app.workspace.getLeaf)).toHaveBeenCalledWith('tab');
      expect(noteLeaf.openFile).not.toHaveBeenCalled();
    });

    it('enters a clicked subfolder at its first item in the map\'s leaf, and closes the popover', async () => {
      const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
      await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
      const popover = getLastPopover();

      getItemEl(popover.params.mapEl, 'd/sub').dispatchEvent(new MouseEvent('click'));
      await vi.waitFor(() => {
        expect(noteLeaf.openFile).toHaveBeenCalledWith(getItem(fixture.app, 'd/sub/x.md'));
      });
      expect(popover.close).toHaveBeenCalledTimes(1);
    });

    it('opens and enters in the leaf a link would open in when the map belongs to no leaf, as a pinned map with no main leaf does', async () => {
      const sub = castTo<TFolder>(getItem(fixture.app, 'd/sub'));
      fixture.component.openFromMap(getItem(fixture.app, 'd/a.md'), null, new MouseEvent('click'));
      fixture.component.enterFromMap(sub, null, new MouseEvent('click'));
      await vi.waitFor(() => {
        expect(fixture.newTabLeaf.openFile.mock.calls.map((call) => castTo<TAbstractFile>(call[0]).path)).toStrictEqual(['d/a.md', 'd/sub/x.md']);
      });
      expect(vi.mocked(fixture.app.workspace.getLeaf).mock.calls).toStrictEqual([[false], [false]]);
    });
  });

  it('closes the popover when unloaded', async () => {
    const noteLeaf = createNoteLeaf(fixture.app, 'd/b.md');
    await fixture.component.show(noteLeaf.leaf, noteLeaf.topButton);
    fixture.component.unload();
    expect(getLastPopover().close).toHaveBeenCalledTimes(1);
  });
});
