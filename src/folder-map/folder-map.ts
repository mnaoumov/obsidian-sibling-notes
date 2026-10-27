import type { TAbstractFile } from 'obsidian';

import {
  setIcon,
  setTooltip,
  TFolder
} from 'obsidian';

import { getItemDisplayName } from '../navigation/folder-sequence.ts';
import { NavigationAction } from '../navigation/navigation-action.ts';
import { NAVIGATION_ACTION_DEFINITIONS } from '../navigation/navigation-command-handler.ts';
import { NAVIGATOR_BAR_ACTIONS } from '../navigator-bar/navigator-bar.ts';

/**
 * The CSS classes of the map. They are the plugin's public styling surface, so a theme or a snippet can
 * restyle the map.
 */
export enum FolderMapCssClass {
  Breadcrumb = 'sibling-notes-folder-map-breadcrumb',
  Breadcrumbs = 'sibling-notes-folder-map-breadcrumbs',
  BreadcrumbSeparator = 'sibling-notes-folder-map-breadcrumb-separator',
  Empty = 'sibling-notes-folder-map-empty',
  Item = 'sibling-notes-folder-map-item',
  ItemIcon = 'sibling-notes-folder-map-item-icon',
  ItemName = 'sibling-notes-folder-map-item-name',
  Items = 'sibling-notes-folder-map-items',
  Map = 'sibling-notes-folder-map',
  Target = 'sibling-notes-folder-map-target',
  Targets = 'sibling-notes-folder-map-targets'
}

/**
 * What a map shows: one folder, from the point of view of one of its items.
 */
export interface FolderMapState {
  /**
   * The item shown in the leaf the map belongs to. It is highlighted.
   */
  readonly currentItem: TAbstractFile;

  /**
   * The folder's ancestors below the root, outermost first, ending with the folder itself. Empty for the
   * root folder.
   */
  readonly folderPath: readonly TFolder[];

  /**
   * The folder's items, in File explorer order.
   */
  readonly items: readonly TAbstractFile[];

  /**
   * The name the root folder is shown by: the vault's.
   */
  readonly rootName: string;

  /**
   * Where each navigator bar button lands, for the buttons that have somewhere to go. The icons follow the bar's order, whatever the map's.
   */
  readonly targets: ReadonlyMap<NavigationAction, TAbstractFile>;
}

interface FolderMapConstructorParams {
  /**
   * Called when a subfolder in the list is clicked.
   */
  readonly onEnter: (folder: TFolder, mouseEvent: MouseEvent) => void;

  /**
   * Called when a file in the list, or a folder in the breadcrumbs, is clicked.
   */
  readonly onOpen: (item: TAbstractFile, mouseEvent: MouseEvent) => void;
}

/**
 * The classes Obsidian itself uses for the current and the hovered item, so themes style them as they
 * style their own lists.
 */
const ACTIVE_CLASS = 'is-active';
const TARGETED_CLASS = 'is-targeted';

const FOLDER_ICON = 'folder';
const FILE_ICON = 'file';
const BREADCRUMB_SEPARATOR = '/';

/**
 * The middle mouse button, which opens a link in a new tab.
 */
const MIDDLE_BUTTON = 1;

/**
 * The folder map: a folder's items in File explorer order under breadcrumbs, with the current item
 * highlighted and each navigator bar button's icon on the item it would reach. Up's icon sits on the
 * folder's own breadcrumb, which is where Up lands.
 *
 * It owns only its element. Where the element goes, and when it is updated, is the caller's business.
 */
export class FolderMap {
  /**
   * The map's element.
   */
  public readonly el: HTMLElement;

  private readonly params: FolderMapConstructorParams;
  private targetedPath: null | string = null;

  public constructor(params: FolderMapConstructorParams) {
    this.params = params;
    this.el = createDiv({ cls: FolderMapCssClass.Map });
  }

  /**
   * Marks the element of the item a hovered bar button would reach, or clears the mark.
   *
   * @param target - The item, or `null` to clear.
   */
  public highlightTarget(target: null | TAbstractFile): void {
    this.targetedPath = target?.path ?? null;
    this.applyTargetHighlight();
  }

  /**
   * Scrolls the current item into view, when the list is taller than its container.
   */
  public scrollToCurrent(): void {
    this.el.querySelector(`.${FolderMapCssClass.Item}.${ACTIVE_CLASS}`)?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Shows a folder, or a placeholder when there is nothing to show.
   *
   * @param state - The state, or `null` when the leaf shows no file or folder.
   */
  public update(state: FolderMapState | null): void {
    this.el.empty();
    if (!state) {
      this.el.createDiv({ cls: FolderMapCssClass.Empty, text: 'Open a note to see its folder.' });
      return;
    }

    const targetActions = new Map<string, NavigationAction[]>();
    for (const action of NAVIGATOR_BAR_ACTIONS) {
      const target = state.targets.get(action);
      if (!target) {
        continue;
      }
      const actions = targetActions.get(target.path) ?? [];
      actions.push(action);
      targetActions.set(target.path, actions);
    }

    this.renderBreadcrumbs(state, targetActions);

    const itemsEl = this.el.createDiv({ cls: FolderMapCssClass.Items });
    if (state.items.length === 0) {
      itemsEl.createDiv({ cls: FolderMapCssClass.Empty, text: 'This folder is empty.' });
    }
    for (const item of state.items) {
      const itemEl = itemsEl.createEl('a', {
        attr: { 'data-path': item.path },
        cls: FolderMapCssClass.Item,
        href: '#'
      });
      itemEl.toggleClass(ACTIVE_CLASS, item === state.currentItem);
      setIcon(itemEl.createSpan({ cls: FolderMapCssClass.ItemIcon }), item instanceof TFolder ? FOLDER_ICON : FILE_ICON);
      itemEl.createSpan({ cls: FolderMapCssClass.ItemName, text: getItemDisplayName(item) });
      renderTargets(itemEl, targetActions.get(item.path));
      this.handleClick(itemEl, (mouseEvent) => {
        if (item instanceof TFolder) {
          this.params.onEnter(item, mouseEvent);
        } else {
          this.params.onOpen(item, mouseEvent);
        }
      });
    }

    this.applyTargetHighlight();
  }

  private applyTargetHighlight(): void {
    for (const el of this.el.querySelectorAll(`.${TARGETED_CLASS}`)) {
      el.removeClass(TARGETED_CLASS);
    }
    if (this.targetedPath === null) {
      return;
    }
    for (const el of this.el.querySelectorAll(`[data-path="${CSS.escape(this.targetedPath)}"]`)) {
      el.addClass(TARGETED_CLASS);
    }
  }

  /**
   * Calls back on a click, and on a middle click, which a link would open in a new tab.
   *
   * @param el - The element.
   * @param callback - The callback.
   */
  private handleClick(el: HTMLElement, callback: (mouseEvent: MouseEvent) => void): void {
    el.addEventListener('click', (mouseEvent) => {
      mouseEvent.preventDefault();
      callback(mouseEvent);
    });
    el.addEventListener('auxclick', (mouseEvent) => {
      if (mouseEvent.button !== MIDDLE_BUTTON) {
        return;
      }

      mouseEvent.preventDefault();
      callback(mouseEvent);
    });
  }

  private renderBreadcrumbs(state: FolderMapState, targetActions: ReadonlyMap<string, readonly NavigationAction[]>): void {
    const breadcrumbsEl = this.el.createDiv({ cls: FolderMapCssClass.Breadcrumbs });
    breadcrumbsEl.createSpan({ cls: FolderMapCssClass.Breadcrumb, text: state.rootName });
    for (const folder of state.folderPath) {
      breadcrumbsEl.createSpan({ cls: FolderMapCssClass.BreadcrumbSeparator, text: BREADCRUMB_SEPARATOR });
      const breadcrumbEl = breadcrumbsEl.createEl('a', {
        attr: { 'data-path': folder.path },
        cls: FolderMapCssClass.Breadcrumb,
        href: '#',
        text: folder.name
      });
      renderTargets(breadcrumbEl, targetActions.get(folder.path));
      this.handleClick(breadcrumbEl, (mouseEvent) => {
        this.params.onOpen(folder, mouseEvent);
      });
    }
  }
}

/**
 * Adds the icons of the bar buttons that reach an item.
 *
 * @param el - The item's element.
 * @param actions - The actions that reach it, if any.
 */
function renderTargets(el: HTMLElement, actions: readonly NavigationAction[] | undefined): void {
  if (!actions) {
    return;
  }
  const targetsEl = el.createSpan({ cls: FolderMapCssClass.Targets });
  for (const action of actions) {
    const definition = NAVIGATION_ACTION_DEFINITIONS[action];
    const targetEl = targetsEl.createSpan({ attr: { 'data-action': action }, cls: FolderMapCssClass.Target });
    setIcon(targetEl, definition.icon);
    setTooltip(targetEl, definition.label);
  }
}
