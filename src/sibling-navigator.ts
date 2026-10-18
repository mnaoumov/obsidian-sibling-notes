import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App,
  TAbstractFile
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

interface SiblingNavigatorConstructorParams {
  readonly app: App;
  readonly getPageSize: () => number;
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

/**
 * Moves through the sequence of the current item's folder.
 *
 * The current item is the active file, unless the last move landed on a subfolder and the active file has
 * not changed since: then it is that subfolder, so the next move continues from it.
 */
export class SiblingNavigator {
  private readonly app: App;
  private readonly getPageSize: () => number;
  private landedFolder: null | TFolder = null;
  private landedFolderActiveFile: null | TFile = null;
  private readonly pluginNoticeComponent: PluginNoticeComponent;

  public constructor(params: SiblingNavigatorConstructorParams) {
    this.app = params.app;
    this.getPageSize = params.getPageSize;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
  }

  /**
   * Returns the item the next move starts from.
   *
   * @returns The current item, or `null` when there is none.
   */
  public getCurrentItem(): null | TAbstractFile {
    const activeFile = this.app.workspace.getActiveFile();
    return this.landedFolder && activeFile === this.landedFolderActiveFile && this.isInVault(this.landedFolder) ? this.landedFolder : activeFile;
  }

  /**
   * Returns where an action would land, read fresh from the File explorer.
   *
   * @param action - The action.
   * @returns The target, or `null` when the action is unavailable.
   */
  public getTarget(action: NavigationAction): null | TAbstractFile {
    const currentItem = this.getCurrentItem();
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
   */
  public async navigate(action: NavigationAction): Promise<void> {
    const target = this.getTarget(action);
    if (target instanceof TFile) {
      this.landedFolder = null;
      this.landedFolderActiveFile = null;
      await this.app.workspace.getLeaf(false).openFile(target);
    } else if (target instanceof TFolder) {
      this.landedFolderActiveFile = this.app.workspace.getActiveFile();
      this.landedFolder = target;
      this.revealFolder(target);
    }
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
}
