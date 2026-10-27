import type {
  FileExplorerView,
  FileTreeItem
} from '@obsidian-typings/obsidian-public-latest';
import type {
  TAbstractFile as TAbstractFileOriginal,
  TFolder as TFolderOriginal
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  App,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getFolderSequence,
  sortByName
} from './folder-sequence.ts';

describe('getFolderSequence', () => {
  let app: App;
  let folder: TFolderOriginal;

  beforeEach(() => {
    app = App.createConfigured__();
    app.vault.createFolderSync__('d');
    app.vault.createSync__('d/b 10.md', '');
    app.vault.createSync__('d/b 9.md', '');
    app.vault.createSync__('d/C.canvas', '');
    app.vault.createSync__('d/a.md', '');
    app.vault.createFolderSync__('d/Zed');
    app.vault.createFolderSync__('d/sub');
    folder = castTo<TFolderOriginal>(app.vault.getFolderByPath('d')?.asOriginalType2__());
  });

  function getPaths(items: readonly TAbstractFileOriginal[]): string[] {
    return items.map((item) => item.path);
  }

  function setLeaves(views: object[]): void {
    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue(castTo<WorkspaceLeaf[]>(views.map((view) => ({ view }))));
  }

  it('falls back to name order, folders first, when the File explorer is disabled', () => {
    setLeaves([]);
    expect(getPaths(getFolderSequence(app.asOriginalType__(), folder))).toStrictEqual([
      'd/sub',
      'd/Zed',
      'd/a.md',
      'd/b 9.md',
      'd/b 10.md',
      'd/C.canvas'
    ]);
  });

  it('falls back to name order while the File explorer view is deferred', () => {
    setLeaves([{}]);
    expect(getPaths(getFolderSequence(app.asOriginalType__(), folder))[0]).toBe('d/sub');
  });

  it('follows the File explorer\'s order, read again on every call', () => {
    const getSortedFolderItems = vi.fn<FileExplorerView['getSortedFolderItems']>();
    setLeaves([{ getSortedFolderItems }]);
    const [first, second] = folder.children;
    if (!first || !second) {
      throw new Error('The folder has no children.');
    }

    getSortedFolderItems.mockReturnValueOnce(castTo<FileTreeItem[]>([{ file: second }, { file: first }]));
    expect(getFolderSequence(app.asOriginalType__(), folder)).toStrictEqual([second, first]);
    getSortedFolderItems.mockReturnValueOnce(castTo<FileTreeItem[]>([{ file: first }, { file: second }]));
    expect(getFolderSequence(app.asOriginalType__(), folder)).toStrictEqual([first, second]);
    expect(getSortedFolderItems).toHaveBeenCalledWith(folder);
  });
});

describe('sortByName', () => {
  it('does not change the order it is given', () => {
    const app = App.createConfigured__();
    app.vault.createSync__('b.md', '');
    app.vault.createSync__('a.md', '');
    const items = castTo<TAbstractFileOriginal[]>(app.vault.getRoot().children.map((child) => child.asOriginalType__()));
    const pathsBefore = items.map((item) => item.path);
    expect(sortByName(items).map((item) => item.path)).toStrictEqual(['a.md', 'b.md']);
    expect(items.map((item) => item.path)).toStrictEqual(pathsBefore);
  });
});
