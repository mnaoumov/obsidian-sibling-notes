import type {
  App,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import {
  Component,
  Keymap,
  Platform,
  TFolder
} from 'obsidian';

import type { NavigationAction } from '../navigation/navigation-action.ts';
import type { SiblingNavigator } from '../navigation/sibling-navigator.ts';
import type { FolderMapPopoverAnchor } from './folder-map-popover.ts';
import type { FolderMapState } from './folder-map.ts';

import { getFolderSequence } from '../navigation/folder-sequence.ts';
import {
  MAP_BUTTON_ACTION,
  NAVIGATOR_BAR_ACTIONS,
  NavigatorBarCssClass
} from '../navigator-bar/navigator-bar.ts';
import { FolderMapPopover } from './folder-map-popover.ts';
import { FolderMapSheet } from './folder-map-sheet.ts';
import {
  FOLDER_MAP_VIEW_TYPE,
  FolderMapView
} from './folder-map-view.ts';
import { FolderMap } from './folder-map.ts';

/**
 * Where across a leaf the popover opens when no Map button of it is shown: its middle.
 */
const CENTER_FRACTION = 0.5;

interface FolderMapComponentConstructorParams {
  readonly app: App;
  readonly siblingNavigator: SiblingNavigator;
}

/**
 * A map that opens over the workspace and goes away again: the popover on desktop, the bottom sheet on
 * mobile.
 */
interface TransientMap {
  readonly anchorEl: HTMLElement | null;
  close: () => void;
  readonly folderMap: FolderMap;
  readonly leaf: WorkspaceLeaf;
}

/**
 * Opens the folder map, keeps every open map current, and highlights in them what a hovered navigator bar
 * button would reach.
 *
 * The map opens as a popover on desktop and as a bottom sheet on mobile. Once it is pinned it lives in a
 * side panel instead, and opening the map reveals that panel.
 */
export class FolderMapComponent extends Component {
  private readonly app: App;
  private readonly siblingNavigator: SiblingNavigator;
  private transientMap: null | TransientMap = null;

  public constructor(params: FolderMapComponentConstructorParams) {
    super();
    this.app = params.app;
    this.siblingNavigator = params.siblingNavigator;
  }

  /**
   * Goes into a folder clicked in a map: in the map's leaf, or in a new tab, split or window with a modifier
   * key or a middle click, as a link would.
   *
   * @param folder - The folder.
   * @param leaf - The leaf the map belongs to.
   * @param mouseEvent - The click.
   */
  public enterFromMap(folder: TFolder, leaf: null | WorkspaceLeaf, mouseEvent: MouseEvent): void {
    const targetLeaf = this.getTargetLeaf(leaf, mouseEvent);
    this.closeTransientMap();
    invokeAsyncSafely(() => this.siblingNavigator.enter(folder, targetLeaf));
  }

  /**
   * Builds what a map shows for a leaf.
   *
   * @param leaf - The leaf.
   * @returns The state, or `null` when the leaf shows no file or folder.
   */
  public getState(leaf: null | WorkspaceLeaf): FolderMapState | null {
    const currentItem = this.siblingNavigator.getLeafItem(leaf);
    if (!currentItem) {
      return null;
    }
    const folder = currentItem.parent;
    if (!folder) {
      return null;
    }

    const folderPath: TFolder[] = [];
    for (let ancestor: null | TFolder = folder; ancestor && !ancestor.isRoot(); ancestor = ancestor.parent) {
      folderPath.unshift(ancestor);
    }

    const targets = new Map<NavigationAction, TAbstractFile>();
    for (const action of NAVIGATOR_BAR_ACTIONS) {
      const target = this.siblingNavigator.getTarget(action, currentItem);
      if (target) {
        targets.set(action, target);
      }
    }

    return {
      currentItem,
      folderPath,
      items: getFolderSequence(this.app, folder),
      rootName: this.app.vault.getName(),
      targets
    };
  }

  /**
   * Marks, in every open map, the item a hovered bar button would reach.
   *
   * @param action - The hovered button's action, or `null` when it is left.
   * @param item - The item the bar's move would start from.
   */
  public highlightTarget(action: NavigationAction | null, item: null | TAbstractFile): void {
    const target = action ? this.siblingNavigator.getTarget(action, item) : null;
    this.transientMap?.folderMap.highlightTarget(target);
    for (const view of this.getViews()) {
      view.highlightTarget(target);
    }
  }

  public override onunload(): void {
    this.closeTransientMap();
  }

  /**
   * Opens an item clicked in a map: in the map's leaf, or in a new tab, split or window with a modifier key
   * or a middle click, as a link would.
   *
   * @param item - The item.
   * @param leaf - The leaf the map belongs to.
   * @param mouseEvent - The click.
   */
  public openFromMap(item: TAbstractFile, leaf: null | WorkspaceLeaf, mouseEvent: MouseEvent): void {
    const targetLeaf = this.getTargetLeaf(leaf, mouseEvent);
    this.closeTransientMap();
    invokeAsyncSafely(() => this.siblingNavigator.open(item, targetLeaf));
  }

  /**
   * Pins the map: opens it in the right side panel, or reveals it there when it is already open.
   */
  public async pin(): Promise<void> {
    this.closeTransientMap();
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(FOLDER_MAP_VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ active: false, type: FOLDER_MAP_VIEW_TYPE });
    }
    if (leaf) {
      await workspace.revealLeaf(leaf);
    }
  }

  /**
   * Keeps every open map current.
   */
  public refresh(): void {
    const transientMap = this.transientMap;
    transientMap?.folderMap.update(this.getState(transientMap.leaf));
    for (const view of this.getViews()) {
      view.refresh();
    }
  }

  /**
   * Shows the map of a leaf's folder: reveals the pinned map when there is one, else opens a bottom sheet on
   * mobile or a popover on desktop. Showing it again from the same Map button closes the popover.
   *
   * @param leaf - The leaf whose item the map is about.
   * @param anchorEl - The Map button it is shown from, or `null` when it is shown by the command.
   */
  public async show(leaf: WorkspaceLeaf, anchorEl: HTMLElement | null): Promise<void> {
    const pinnedLeaf = this.app.workspace.getLeavesOfType(FOLDER_MAP_VIEW_TYPE)[0];
    if (pinnedLeaf) {
      this.closeTransientMap();
      await this.app.workspace.revealLeaf(pinnedLeaf);
      return;
    }

    const wasShownFromAnchor = anchorEl !== null && this.transientMap?.anchorEl === anchorEl;
    this.closeTransientMap();
    if (wasShownFromAnchor) {
      return;
    }

    const folderMap = new FolderMap({
      onEnter: (folder, mouseEvent): void => {
        this.enterFromMap(folder, leaf, mouseEvent);
      },
      onOpen: (item, mouseEvent): void => {
        this.openFromMap(item, leaf, mouseEvent);
      }
    });
    folderMap.update(this.getState(leaf));

    const containerParams = {
      mapEl: folderMap.el,
      onClose: (): void => {
        if (this.transientMap?.folderMap === folderMap) {
          this.transientMap = null;
        }
      },
      onPin: (): void => {
        invokeAsyncSafely(() => this.pin());
      }
    };

    if (Platform.isMobile) {
      const sheet = new FolderMapSheet({ ...containerParams, app: this.app });
      this.transientMap = {
        anchorEl: null,
        close: (): void => {
          sheet.close();
        },
        folderMap,
        leaf
      };
      sheet.open();
    } else {
      const popover = new FolderMapPopover({ ...containerParams, anchor: getAnchor(leaf, anchorEl ?? findMapButton(leaf)) });
      this.transientMap = {
        anchorEl: popover.anchorEl,
        close: (): void => {
          popover.close();
        },
        folderMap,
        leaf
      };
    }
    folderMap.scrollToCurrent();
  }

  private closeTransientMap(): void {
    const transientMap = this.transientMap;
    this.transientMap = null;
    transientMap?.close();
  }

  private getTargetLeaf(leaf: null | WorkspaceLeaf, mouseEvent: MouseEvent): WorkspaceLeaf {
    const paneType = Keymap.isModEvent(mouseEvent);
    return paneType || !leaf ? this.app.workspace.getLeaf(paneType) : leaf;
  }

  private getViews(): FolderMapView[] {
    return this.app.workspace.getLeavesOfType(FOLDER_MAP_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view) => view instanceof FolderMapView);
  }
}

/**
 * Finds a leaf's shown Map button, top bar first.
 *
 * @param leaf - The leaf.
 * @returns The button, or `null` when no bar of the leaf is shown.
 */
function findMapButton(leaf: WorkspaceLeaf): HTMLElement | null {
  const buttons = leaf.view.containerEl.querySelectorAll<HTMLElement>(`.${NavigatorBarCssClass.Bar} button[data-action="${CSS.escape(MAP_BUTTON_ACTION)}"]`);
  return [...buttons].find((button) => button.isShown()) ?? null;
}

/**
 * Anchors the popover at a Map button, or at the top of the leaf when there is none.
 *
 * @param leaf - The leaf.
 * @param mapButton - The Map button, if any.
 * @returns The anchor.
 */
function getAnchor(leaf: WorkspaceLeaf, mapButton: HTMLElement | null): FolderMapPopoverAnchor {
  const el = mapButton ?? leaf.view.containerEl;
  const rect = el.getBoundingClientRect();
  return mapButton
    ? { bottom: rect.bottom, doc: el.ownerDocument, el: mapButton, left: rect.left, top: rect.top }
    : { bottom: rect.top, doc: el.ownerDocument, el: null, left: rect.left + rect.width * CENTER_FRACTION, top: rect.top };
}
