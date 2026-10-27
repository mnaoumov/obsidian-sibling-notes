import type {
  App,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  FileView,
  TFile,
  TFolder
} from 'obsidian';

import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from '../virtual-folder-note/virtual-folder-note-view.ts';
import { getFolderSequence } from './folder-sequence.ts';
import {
  getNavigationTargetIndex,
  NavigationAction
} from './navigation-action.ts';

/**
 * Where a move starts: the item shown, and the leaf the landed item opens in.
 */
export interface NavigationOrigin {
  readonly item: null | TAbstractFile;
  readonly leaf: WorkspaceLeaf;
}

/**
 * The current item's place in its folder's sequence.
 */
export interface SequencePosition {
  /**
   * The zero-based index of the current item.
   */
  readonly index: number;

  /**
   * How many items the sequence has.
   */
  readonly length: number;
}

interface SiblingNavigatorConstructorParams {
  readonly app: App;
  readonly getPageSize: () => number;
}

/**
 * Moves through the sequence of the current item's folder.
 *
 * The current item is what the view shows: a file, or the folder a virtual folder note stands for. Without
 * an explicit item it is the active view's, which is what the commands use.
 */
export class SiblingNavigator {
  private readonly app: App;
  private readonly getPageSize: () => number;

  public constructor(params: SiblingNavigatorConstructorParams) {
    this.app = params.app;
    this.getPageSize = params.getPageSize;
  }

  /**
   * Goes into a folder, in a leaf: to its first item, or to its virtual folder note when it is empty.
   *
   * @param folder - The folder.
   * @param leaf - The leaf.
   */
  public async enter(folder: TFolder, leaf: WorkspaceLeaf): Promise<void> {
    await this.open(this.getTarget(NavigationAction.Enter, folder) ?? folder, leaf);
  }

  /**
   * Returns the item the active view shows.
   *
   * @returns The folder of an active virtual folder note, else the active file, or `null` when there is none.
   */
  public getCurrentItem(): null | TAbstractFile {
    const virtualFolderNoteView = this.app.workspace.getActiveViewOfType(VirtualFolderNoteView);
    return virtualFolderNoteView ? virtualFolderNoteView.folder : this.app.workspace.getActiveFile();
  }

  /**
   * Returns the item a leaf shows.
   *
   * @param leaf - The leaf.
   * @returns The folder of a virtual folder note, else the file of a file view, or `null` for any other view.
   */
  public getLeafItem(leaf: null | WorkspaceLeaf): null | TAbstractFile {
    const view = leaf?.view;
    if (view instanceof VirtualFolderNoteView) {
      return view.folder;
    }
    return view instanceof FileView ? view.file : null;
  }

  /**
   * Returns an item's place in its folder's sequence, read fresh from the File explorer.
   *
   * @param item - The item. Defaults to the current item.
   * @returns The position, or `null` when there is no item or it is the root folder.
   */
  public getPosition(item: null | TAbstractFile = this.getCurrentItem()): null | SequencePosition {
    const folder = item?.parent;
    if (!item || !folder) {
      return null;
    }

    const sequence = getFolderSequence(this.app, folder);
    const index = sequence.indexOf(item);
    return index === -1 ? null : { index, length: sequence.length };
  }

  /**
   * Returns where an action would land, read fresh from the File explorer.
   *
   * @param action - The action.
   * @param item - The item the move starts from. Defaults to the current item.
   * @returns The target, or `null` when the action is unavailable.
   */
  public getTarget(action: NavigationAction, item: null | TAbstractFile = this.getCurrentItem()): null | TAbstractFile {
    if (!item) {
      return null;
    }

    if (action === NavigationAction.Enter) {
      return item instanceof TFolder ? getFolderSequence(this.app, item)[0] ?? null : null;
    }

    const folder = item.parent;
    if (!folder) {
      return null;
    }

    if (action === NavigationAction.Up) {
      // The root folder is in no folder's sequence, so there is nothing above it to go to.
      return folder.isRoot() ? null : folder;
    }

    const sequence = getFolderSequence(this.app, folder);
    const targetIndex = getNavigationTargetIndex({
      action,
      currentIndex: sequence.indexOf(item),
      length: sequence.length,
      pageSize: this.getPageSize()
    });
    return targetIndex === undefined ? null : ensureNonNullable(sequence[targetIndex]);
  }

  /**
   * Performs an action: opens the item it lands on.
   *
   * @param action - The action.
   * @param origin - The item the move starts from and the leaf it opens in. Defaults to the current item
   * and the leaf a link would open in.
   */
  public async navigate(action: NavigationAction, origin?: NavigationOrigin): Promise<void> {
    const target = this.getTarget(action, origin ? origin.item : this.getCurrentItem());
    if (target) {
      await this.open(target, origin?.leaf ?? this.app.workspace.getLeaf(false));
    }
  }

  /**
   * Opens an item in a leaf: a file as itself, a folder as its virtual folder note.
   *
   * @param item - The item.
   * @param leaf - The leaf.
   */
  public async open(item: TAbstractFile, leaf: WorkspaceLeaf): Promise<void> {
    if (item instanceof TFile) {
      await leaf.openFile(item);
    } else if (item instanceof TFolder) {
      await leaf.setViewState({
        active: true,
        state: VirtualFolderNoteView.createState(item),
        type: VIRTUAL_FOLDER_NOTE_VIEW_TYPE
      });
    }
  }
}
