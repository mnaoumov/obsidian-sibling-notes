import type {
  App as AppOriginal,
  TAbstractFile,
  TFile as TFileOriginal,
  TFolder as TFolderOriginal,
  WorkspaceLeaf
} from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { FileView } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from '../virtual-folder-note/virtual-folder-note-view.ts';
import { NavigationAction } from './navigation-action.ts';
import { SiblingNavigator } from './sibling-navigator.ts';

interface Fixture {
  readonly app: AppOriginal;
  readonly navigator: SiblingNavigator;
  readonly openFile: ReturnType<typeof vi.fn>;
  setActiveFile: (path: null | string) => void;
  setActiveFolderView: (path: null | string) => void;
  readonly setViewState: ReturnType<typeof vi.fn>;
}

const PAGE_SIZE = 2;

describe('SiblingNavigator', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  function getTargetPath(action: NavigationAction): null | string {
    return fixture.navigator.getTarget(action)?.path ?? null;
  }

  it('has no current item and no target without an active file', () => {
    fixture.setActiveFile(null);
    expect(fixture.navigator.getCurrentItem()).toBeNull();
    expect(getTargetPath(NavigationAction.Next)).toBeNull();
    expect(getTargetPath(NavigationAction.Up)).toBeNull();
    expect(getTargetPath(NavigationAction.Enter)).toBeNull();
  });

  it('answers every in-folder action from the sequence of the active file\'s folder', () => {
    fixture.setActiveFile('d/b.md');
    expect(getTargetPath(NavigationAction.Previous)).toBe('d/a.md');
    expect(getTargetPath(NavigationAction.Next)).toBe('d/c.md');
    expect(getTargetPath(NavigationAction.Home)).toBe('d/sub');
    expect(getTargetPath(NavigationAction.End)).toBe('d/e.md');
    expect(getTargetPath(NavigationAction.PageUp)).toBe('d/sub');
    expect(getTargetPath(NavigationAction.PageDown)).toBe('d/e.md');
    expect(getTargetPath(NavigationAction.Enter)).toBeNull();
  });

  it('goes up to the folder just left, and not above a root-level item', () => {
    fixture.setActiveFile('d/sub/x.md');
    expect(getTargetPath(NavigationAction.Up)).toBe('d/sub');
    fixture.setActiveFile('top.md');
    expect(getTargetPath(NavigationAction.Up)).toBeNull();
  });

  it('opens a file it lands on', async () => {
    fixture.setActiveFile('d/b.md');
    await fixture.navigator.navigate(NavigationAction.Next);
    expect(castTo<TAbstractFile>(fixture.openFile.mock.calls[0]?.[0]).path).toBe('d/c.md');
  });

  it('does nothing for an unavailable action', async () => {
    fixture.setActiveFile('d/e.md');
    await fixture.navigator.navigate(NavigationAction.Next);
    expect(fixture.openFile).not.toHaveBeenCalled();
    expect(fixture.setViewState).not.toHaveBeenCalled();
  });

  it('lands on a subfolder by opening its virtual folder note', async () => {
    fixture.setActiveFile('d/a.md');
    await fixture.navigator.navigate(NavigationAction.Previous);
    expect(fixture.setViewState).toHaveBeenCalledWith({
      active: true,
      state: { folderPath: 'd/sub' },
      type: VIRTUAL_FOLDER_NOTE_VIEW_TYPE
    });
  });

  it('moves from an active virtual folder note as from its folder, and enters it', () => {
    fixture.setActiveFile('top.md');
    fixture.setActiveFolderView('d/sub');
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/sub');
    expect(getTargetPath(NavigationAction.Next)).toBe('d/a.md');
    expect(getTargetPath(NavigationAction.Previous)).toBeNull();
    expect(getTargetPath(NavigationAction.Up)).toBe('d');
    expect(getTargetPath(NavigationAction.Enter)).toBe('d/sub/x.md');
    expect(fixture.navigator.getPosition()).toStrictEqual({ index: 0, length: 5 });
  });

  it('has nothing to enter in an empty folder, and no current item for a deleted one', () => {
    fixture.setActiveFolderView('empty');
    expect(getTargetPath(NavigationAction.Enter)).toBeNull();
    fixture.setActiveFolderView(null);
    expect(fixture.navigator.getCurrentItem()).toBeNull();
  });

  it('answers the position of the current item, and none without one', () => {
    fixture.setActiveFile('d/b.md');
    expect(fixture.navigator.getPosition()).toStrictEqual({ index: 2, length: 5 });
    fixture.setActiveFile(null);
    expect(fixture.navigator.getPosition()).toBeNull();
  });

  it('starts from a given item and opens in a given leaf', async () => {
    fixture.setActiveFile('top.md');
    const item = fixture.app.vault.getFileByPath('d/a.md');
    const leafOpenFile: ReturnType<typeof vi.fn> = vi.fn(() => noopAsync());
    const leafSetViewState: ReturnType<typeof vi.fn> = vi.fn(() => noopAsync());
    const leaf = castTo<WorkspaceLeaf>({ openFile: leafOpenFile, setViewState: leafSetViewState });

    expect(fixture.navigator.getTarget(NavigationAction.Next, item)?.path).toBe('d/b.md');
    await fixture.navigator.navigate(NavigationAction.Next, { item, leaf });
    expect(castTo<TAbstractFile>(leafOpenFile.mock.calls[0]?.[0]).path).toBe('d/b.md');
    await fixture.navigator.navigate(NavigationAction.Previous, { item, leaf });
    expect(leafSetViewState).toHaveBeenCalledTimes(1);
    expect(fixture.openFile).not.toHaveBeenCalled();
  });

  it('enters a folder at its first item, and an empty one at its virtual folder note', async () => {
    const sub = fixture.app.vault.getFolderByPath('d/sub');
    const empty = fixture.app.vault.getFolderByPath('empty');
    if (!sub || !empty) {
      throw new Error('No folders.');
    }
    const leaf = fixture.app.workspace.getLeaf(false);
    await fixture.navigator.enter(sub, leaf);
    expect(castTo<TAbstractFile>(fixture.openFile.mock.calls[0]?.[0]).path).toBe('d/sub/x.md');
    await fixture.navigator.enter(empty, leaf);
    expect(fixture.setViewState).toHaveBeenCalledWith({
      active: true,
      state: { folderPath: 'empty' },
      type: VIRTUAL_FOLDER_NOTE_VIEW_TYPE
    });
  });

  it('reads the item a leaf shows: a file view\'s file, and nothing for another view or no leaf', () => {
    const file = fixture.app.vault.getFileByPath('d/a.md');
    const fileView = castTo<FileView>(Object.create(FileView.prototype));
    fileView.file = file;
    expect(fixture.navigator.getLeafItem(castTo<WorkspaceLeaf>({ view: fileView }))).toBe(file);
    expect(fixture.navigator.getLeafItem(castTo<WorkspaceLeaf>({ view: {} }))).toBeNull();
    expect(fixture.navigator.getLeafItem(null)).toBeNull();
  });

  it('reads the folder a virtual folder note in a leaf stands for', () => {
    const folder = fixture.app.vault.getFolderByPath('d/sub');
    const view = castTo<VirtualFolderNoteView>(Object.create(VirtualFolderNoteView.prototype));
    Object.defineProperty(view, 'folder', { value: folder });
    expect(fixture.navigator.getLeafItem(castTo<WorkspaceLeaf>({ view }))).toBe(folder);
  });

  it('has no target but Enter from the root folder, which is in no folder\'s sequence', () => {
    const root = fixture.app.vault.getRoot();
    for (const action of [NavigationAction.Previous, NavigationAction.Next, NavigationAction.Home, NavigationAction.End, NavigationAction.Up]) {
      expect(fixture.navigator.getTarget(action, root)).toBeNull();
    }
    expect(fixture.navigator.getTarget(NavigationAction.Enter, root)?.path).toBe('d');
    expect(fixture.navigator.getPosition(root)).toBeNull();
  });

  it('gives no position to an item the File explorer hides', () => {
    const hiddenPath = 'd/b.md';
    vi.mocked(fixture.app.workspace.getLeavesOfType).mockReturnValue([
      castTo<WorkspaceLeaf>({
        view: {
          getSortedFolderItems: (folder: TFolderOriginal) => folder.children.filter((item) => item.path !== hiddenPath).map((file) => ({ file }))
        }
      })
    ]);
    expect(fixture.navigator.getPosition(fixture.app.vault.getFileByPath(hiddenPath))).toBeNull();
    expect(fixture.navigator.getPosition(fixture.app.vault.getFileByPath('d/c.md'))).toStrictEqual({ index: 2, length: 4 });
  });

  it('opens nothing for an item that is neither a file nor a folder', async () => {
    const leaf = fixture.app.workspace.getLeaf(false);
    await fixture.navigator.open(castTo<TAbstractFile>({ path: 'other' }), leaf);
    expect(fixture.openFile).not.toHaveBeenCalled();
    expect(fixture.setViewState).not.toHaveBeenCalled();
  });
});

function createFixture(): Fixture {
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('d');
  mockApp.vault.createFolderSync__('d/sub');
  mockApp.vault.createSync__('d/sub/x.md', '');
  for (const name of ['a', 'b', 'c', 'e']) {
    mockApp.vault.createSync__(`d/${name}.md`, '');
  }
  mockApp.vault.createSync__('top.md', '');
  mockApp.vault.createFolderSync__('empty');
  const app = mockApp.asOriginalType__();

  let activeFile: null | TFileOriginal = null;
  let activeFolderView: null | VirtualFolderNoteView = null;
  vi.spyOn(app.workspace, 'getActiveFile').mockImplementation(() => activeFile);
  vi.spyOn(app.workspace, 'getActiveViewOfType').mockImplementation(() => activeFolderView);
  vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
  const openFile = vi.fn(() => noopAsync());
  const setViewState = vi.fn(() => noopAsync());
  vi.spyOn(app.workspace, 'getLeaf').mockReturnValue(castTo<WorkspaceLeaf>({ openFile, setViewState }));

  return {
    app,
    navigator: new SiblingNavigator({
      app,
      getPageSize: () => PAGE_SIZE
    }),
    openFile,
    setActiveFile(path: null | string): void {
      activeFile = path === null ? null : app.vault.getFileByPath(path);
    },
    setActiveFolderView(path: null | string): void {
      const folder: null | TFolderOriginal = path === null ? null : app.vault.getFolderByPath(path);
      activeFolderView = castTo<VirtualFolderNoteView>({ folder });
    },
    setViewState
  };
}
