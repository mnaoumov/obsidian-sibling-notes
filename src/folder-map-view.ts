import type {
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { ItemView } from 'obsidian';

import type { FolderMapComponent } from './folder-map-component.ts';

import { FOLDER_MAP_TITLE } from './folder-map-popover.ts';
import { FolderMap } from './folder-map.ts';

interface FolderMapViewConstructorParams {
  readonly folderMapComponent: FolderMapComponent;
  readonly leaf: WorkspaceLeaf;
}

/**
 * The view type of the pinned folder map.
 */
export const FOLDER_MAP_VIEW_TYPE = 'sibling-notes-folder-map';

/**
 * The CSS class of the pinned folder map's view.
 */
export const FOLDER_MAP_VIEW_CSS_CLASS = 'sibling-notes-folder-map-view';

/**
 * The folder map pinned to a side panel. It follows the most recent leaf of the main area, and opens what
 * is clicked there.
 */
export class FolderMapView extends ItemView {
  private readonly folderMap: FolderMap;
  private readonly folderMapComponent: FolderMapComponent;

  public constructor(params: FolderMapViewConstructorParams) {
    super(params.leaf);
    this.folderMapComponent = params.folderMapComponent;
    this.folderMap = new FolderMap({
      onEnter: (folder, mouseEvent): void => {
        this.folderMapComponent.enterFromMap(folder, this.getMainLeaf(), mouseEvent);
      },
      onOpen: (item, mouseEvent): void => {
        this.folderMapComponent.openFromMap(item, this.getMainLeaf(), mouseEvent);
      }
    });
  }

  public override getDisplayText(): string {
    return FOLDER_MAP_TITLE;
  }

  public override getIcon(): string {
    return 'map';
  }

  public override getViewType(): string {
    return FOLDER_MAP_VIEW_TYPE;
  }

  /**
   * Marks the item a hovered bar button would reach, or clears the mark.
   *
   * @param target - The item, or `null` to clear.
   */
  public highlightTarget(target: null | TAbstractFile): void {
    this.folderMap.highlightTarget(target);
  }

  /**
   * Shows the folder of the main area's most recent leaf as it is now.
   */
  public refresh(): void {
    this.folderMap.update(this.folderMapComponent.getState(this.getMainLeaf()));
    this.folderMap.scrollToCurrent();
  }

  protected override async onOpen(): Promise<void> {
    await super.onOpen();
    this.containerEl.addClass(FOLDER_MAP_VIEW_CSS_CLASS);
    this.contentEl.empty();
    this.contentEl.append(this.folderMap.el);
    this.refresh();
  }

  private getMainLeaf(): null | WorkspaceLeaf {
    return this.app.workspace.getMostRecentLeaf();
  }
}
