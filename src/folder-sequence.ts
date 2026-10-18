import type { FileExplorerView } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TAbstractFile,
  View
} from 'obsidian';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import { TFolder } from 'obsidian';

/**
 * Compares names the way the File explorer's `File name (A to Z)` order does: case-insensitive, with runs
 * of digits compared as numbers, so `b 9` comes before `b 10`.
 */
const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Returns a folder's own items, subfolders included, in the order the File explorer shows them.
 *
 * The order is read from the explorer on every call rather than cached, so a change of sort order and a
 * custom-sort plugin, which patches the same method, are both followed. When the File explorer is
 * disabled, or its view has not been loaded yet, the items come in name order instead.
 *
 * @param app - The Obsidian app.
 * @param folder - The folder.
 * @returns The folder's items.
 */
export function getFolderSequence(app: App, folder: TFolder): TAbstractFile[] {
  const fileExplorerView = getFileExplorerView(app);
  return fileExplorerView ? fileExplorerView.getSortedFolderItems(folder).map((item): TAbstractFile => item.file) : sortByName(folder.children);
}

/**
 * Sorts items the way the File explorer's `File name (A to Z)` order does: folders first, then files,
 * each by name.
 *
 * @param items - The items.
 * @returns A sorted copy.
 */
export function sortByName(items: readonly TAbstractFile[]): TAbstractFile[] {
  return [...items].sort((a, b) => {
    const isAFolder = a instanceof TFolder;
    const isBFolder = b instanceof TFolder;
    if (isAFolder !== isBFolder) {
      return isAFolder ? -1 : 1;
    }
    return NAME_COLLATOR.compare(a.name, b.name);
  });
}

function getFileExplorerView(app: App): FileExplorerView | null {
  const view = app.workspace.getLeavesOfType(ViewType.FileExplorer)[0]?.view;
  return view && isFileExplorerView(view) ? view : null;
}

/**
 * Tells a loaded File explorer view from a deferred one, which cannot sort anything yet.
 *
 * @param view - The view of a `file-explorer` leaf.
 * @returns Whether the view is loaded.
 */
function isFileExplorerView(view: View): view is FileExplorerView {
  return 'getSortedFolderItems' in view;
}
