import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  TFile,
  TFolder
} from 'obsidian';

import { getFolderSequence } from './folder-sequence.ts';
import {
  getNavigationTargetIndex,
  NavigationAction
} from './navigation-action.ts';

/**
 * Where a move starts: the file shown, and the leaf a landed file opens in.
 */
export interface NavigationOrigin {
  readonly file: null | TFile;
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
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

/**
 * Moves through the sequence of the current item's folder.
 *
 * The current item is the file shown, unless the last move from that file landed on a subfolder: then it
 * is that subfolder, so the next move continues from it. Without an explicit file, the file shown is the
 * active file, which is what the commands use.
 */
export class SiblingNavigator {
  private readonly app: App;
  private readonly currentItemChangeListeners = new Set<() => void>();
  private readonly getPageSize: () => number;
  private landedFolder: null | TFolder = null;
  private landedFromFile: null | TFile = null;
  private readonly pluginNoticeComponent: PluginNoticeComponent;

  public constructor(params: SiblingNavigatorConstructorParams) {
    this.app = params.app;
    this.getPageSize = params.getPageSize;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
  }

  /**
   * Returns the item the next move starts from.
   *
   * @param file - The file shown. Defaults to the active file.
   * @returns The current item, or `null` when there is none.
   */
  public getCurrentItem(file: null | TFile = this.app.workspace.getActiveFile()): null | TAbstractFile {
    return this.landedFolder && file && file === this.landedFromFile && this.isInVault(this.landedFolder) ? this.landedFolder : file;
  }

  /**
   * Returns the current item's place in its folder's sequence, read fresh from the File explorer.
   *
   * @param file - The file shown. Defaults to the active file.
   * @returns The position, or `null` when there is no current item or it is the root folder.
   */
  public getPosition(file: null | TFile = this.app.workspace.getActiveFile()): null | SequencePosition {
    const currentItem = this.getCurrentItem(file);
    const folder = currentItem?.parent;
    if (!currentItem || !folder) {
      return null;
    }

    const sequence = getFolderSequence(this.app, folder);
    const index = sequence.indexOf(currentItem);
    return index === -1 ? null : { index, length: sequence.length };
  }

  /**
   * Returns where an action would land, read fresh from the File explorer.
   *
   * @param action - The action.
   * @param file - The file shown. Defaults to the active file.
   * @returns The target, or `null` when the action is unavailable.
   */
  public getTarget(action: NavigationAction, file: null | TFile = this.app.workspace.getActiveFile()): null | TAbstractFile {
    const currentItem = this.getCurrentItem(file);
    const folder = currentItem?.parent;
    if (!currentItem || !folder) {
      return null;
    }

    if (action === NavigationAction.Up) {
      // The root folder is in no folder's sequence, so there is nothing above it to go to.
      return folder.isRoot() ? null : folder;
    }

    const sequence = getFolderSequence(this.app, folder);
    const targetIndex = getNavigationTargetIndex({
      action,
      currentIndex: sequence.indexOf(currentItem),
      length: sequence.length,
      pageSize: this.getPageSize()
    });
    return targetIndex === undefined ? null : sequence[targetIndex] ?? null;
  }

  /**
   * Performs an action: opens the file it lands on, or lands on the subfolder.
   *
   * @param action - The action.
   * @param origin - The file the move starts from and the leaf it opens in. Defaults to the active file
   * and the active leaf.
   */
  public async navigate(action: NavigationAction, origin?: NavigationOrigin): Promise<void> {
    const file = origin ? origin.file : this.app.workspace.getActiveFile();
    const target = this.getTarget(action, file);
    if (target instanceof TFile) {
      this.setLandedFolder(null, null);
      await (origin?.leaf ?? this.app.workspace.getLeaf(false)).openFile(target);
    } else if (target instanceof TFolder) {
      this.setLandedFolder(target, file);
      this.revealFolder(target);
    }
  }

  /**
   * Calls a listener whenever a move changes the current item without opening a file, which is when the
   * active file alone no longer tells where the navigator is.
   *
   * @param listener - The listener.
   * @returns A function that removes the listener.
   */
  public onCurrentItemChange(listener: () => void): () => void {
    this.currentItemChangeListeners.add(listener);
    return (): void => {
      this.currentItemChangeListeners.delete(listener);
    };
  }

  private isInVault(item: TAbstractFile): boolean {
    return this.app.vault.getAbstractFileByPath(item.path) === item;
  }

  // TODO: Open the folder's virtual folder note here instead, once that view exists. Until then a landed
  // Subfolder is only shown in the File explorer.
  private revealFolder(folder: TFolder): void {
    const fileExplorer = this.app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer);
    if (!fileExplorer) {
      this.pluginNoticeComponent.showNotice(`Moved to the folder ${folder.path}. Enable the File explorer to see it.`);
      return;
    }
    fileExplorer.revealInFolder(folder);
  }

  private setLandedFolder(folder: null | TFolder, fromFile: null | TFile): void {
    if (this.landedFolder === folder && this.landedFromFile === fromFile) {
      return;
    }
    this.landedFolder = folder;
    this.landedFromFile = fromFile;
    for (const listener of this.currentItemChangeListeners) {
      listener();
    }
  }
}
