import type {
  TAbstractFile,
  ViewStateResult,
  WorkspaceLeaf
} from 'obsidian';

import { MARKDOWN_FILE_EXTENSION } from '@mnaoumov/obsidian-lib/file-system';
import { fullRender } from '@mnaoumov/obsidian-lib/markdown';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import {
  Component,
  getFrontMatterInfo,
  ItemView,
  Keymap,
  setIcon,
  TFile,
  TFolder
} from 'obsidian';

import type { FolderNoteConventions } from './folder-note-finder.ts';
import type { NavigatorBarVisibility } from './navigator-bar-component.ts';
import type { SiblingNavigator } from './sibling-navigator.ts';

import { findFolderNote } from './folder-note-finder.ts';
import { getFolderSequence } from './folder-sequence.ts';
import { NavigationAction } from './navigation-action.ts';
import {
  NavigatorBar,
  NavigatorBarPlacement
} from './navigator-bar.ts';

/**
 * The settings the view follows.
 */
export interface VirtualFolderNoteViewSettings extends FolderNoteConventions, NavigatorBarVisibility {}

interface VirtualFolderNoteViewConstructorParams {
  readonly getSettings: () => VirtualFolderNoteViewSettings;
  readonly leaf: WorkspaceLeaf;
  readonly siblingNavigator: SiblingNavigator;
}

/**
 * The view's state, as the workspace saves and restores it.
 */
interface VirtualFolderNoteViewState extends Record<string, unknown> {
  /**
   * The path of the folder the view stands for.
   */
  readonly folderPath: string;
}

/**
 * The view type of the virtual folder note.
 */
export const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';

/**
 * The CSS classes of the view. They are the plugin's public styling surface, so a theme or a snippet can
 * restyle the view.
 */
export enum VirtualFolderNoteViewCssClass {
  Content = 'sibling-notes-virtual-folder-note-content',
  Empty = 'sibling-notes-virtual-folder-note-empty',
  EnterButton = 'sibling-notes-virtual-folder-note-enter',
  FolderNote = 'sibling-notes-virtual-folder-note-folder-note',
  FolderNoteBody = 'sibling-notes-virtual-folder-note-folder-note-body',
  FolderNoteTitle = 'sibling-notes-virtual-folder-note-folder-note-title',
  Item = 'sibling-notes-virtual-folder-note-item',
  ItemIcon = 'sibling-notes-virtual-folder-note-item-icon',
  Items = 'sibling-notes-virtual-folder-note-items',
  Title = 'sibling-notes-virtual-folder-note-title',
  View = 'sibling-notes-virtual-folder-note'
}

const FOLDER_ICON = 'folder';
const FILE_ICON = 'file';

/**
 * The middle mouse button, which opens a link in a new tab.
 */
const MIDDLE_BUTTON = 1;

/**
 * The virtual folder note: what a subfolder is in its parent's sequence. It is a view, not a file.
 *
 * It shows the folder's items in File explorer order, each one opening on a click, an Enter button that
 * goes to the first of them, and the folder's folder note, when it has one. A navigator bar sits above
 * and below, as on a note.
 */
export class VirtualFolderNoteView extends ItemView {
  public override navigation = true;

  /**
   * The folder the view stands for, or `null` before a state is set and after the folder is deleted.
   */
  public get folder(): null | TFolder {
    return this._folder;
  }

  private _folder: null | TFolder = null;
  private bottomBar: NavigatorBar | null = null;
  private enterButton: HTMLButtonElement | null = null;
  private folderNoteEl: HTMLElement | null = null;
  private readonly getSettings: () => VirtualFolderNoteViewSettings;
  private inlineTitleEl: HTMLElement | null = null;
  private itemsEl: HTMLElement | null = null;
  private pageEl: HTMLElement | null = null;
  private renderedFolderNote: null | TFile = null;
  private renderedFolderNoteComponent: Component | null = null;
  private renderedFolderNotePath: null | string = null;
  private renderVersion = 0;
  private readonly siblingNavigator: SiblingNavigator;
  private topBar: NavigatorBar | null = null;

  public constructor(params: VirtualFolderNoteViewConstructorParams) {
    super(params.leaf);
    this.getSettings = params.getSettings;
    this.siblingNavigator = params.siblingNavigator;
  }

  /**
   * Builds the state that opens a folder's virtual folder note.
   *
   * @param folder - The folder.
   * @returns The view state.
   */
  public static createState(folder: TFolder): VirtualFolderNoteViewState {
    return { folderPath: folder.path };
  }

  public override getDisplayText(): string {
    return this._folder?.name ?? 'Folder';
  }

  public override getIcon(): string {
    return FOLDER_ICON;
  }

  public override getState(): Record<string, unknown> {
    const state = super.getState();
    return this._folder ? { ...state, ...VirtualFolderNoteView.createState(this._folder) } : state;
  }

  public override getViewType(): string {
    return VIRTUAL_FOLDER_NOTE_VIEW_TYPE;
  }

  /**
   * Shows the folder as it is now: the bars, the items, the Enter button and the folder note. The folder
   * note is rendered again only when it is another note, or when it changed.
   */
  public refresh(): void {
    if (this._folder && this.app.vault.getAbstractFileByPath(this._folder.path) !== this._folder) {
      this._folder = null;
    }
    // The tab follows the leaf's header, but the view's own header title is written once, when the view
    // Opens before it has a folder, so a rename or the first state would leave it stale.
    this.leaf.updateHeader();
    this.titleEl.setText(this.getDisplayText());
    this.refreshBars();
    this.refreshItems();
    this.refreshFolderNote(false);
  }

  public override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const folderPath = isVirtualFolderNoteViewState(state) ? state.folderPath : null;
    this._folder = folderPath === null ? null : this.app.vault.getFolderByPath(folderPath);
    await super.setState(state, result);
    this.refresh();
  }

  protected override async onClose(): Promise<void> {
    this.unloadFolderNote();
    await super.onClose();
  }

  protected override async onOpen(): Promise<void> {
    await super.onOpen();
    this.containerEl.addClass(VirtualFolderNoteViewCssClass.View);
    this.contentEl.empty();

    const onAction = this.navigate.bind(this);
    this.topBar = new NavigatorBar({ onAction, placement: NavigatorBarPlacement.Top });
    this.bottomBar = new NavigatorBar({ onAction, placement: NavigatorBarPlacement.Bottom });

    this.pageEl = this.contentEl.createDiv({ cls: VirtualFolderNoteViewCssClass.Content });
    this.inlineTitleEl = this.pageEl.createDiv({ cls: ['inline-title', VirtualFolderNoteViewCssClass.Title] });
    this.enterButton = this.pageEl.createEl('button', {
      cls: ['mod-cta', VirtualFolderNoteViewCssClass.EnterButton],
      text: 'Enter'
    });
    this.enterButton.addEventListener('click', () => {
      onAction(NavigationAction.Enter);
    });
    this.itemsEl = this.pageEl.createDiv({ cls: VirtualFolderNoteViewCssClass.Items });
    this.folderNoteEl = this.pageEl.createDiv({ cls: VirtualFolderNoteViewCssClass.FolderNote });

    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file === this.renderedFolderNote) {
        this.refreshFolderNote(true);
      }
    }));

    this.refresh();
  }

  private async getFolderNoteMarkdown(folderNote: TFile): Promise<string> {
    if (folderNote.extension !== MARKDOWN_FILE_EXTENSION) {
      return `![[${folderNote.path}]]`;
    }
    const content = await this.app.vault.cachedRead(folderNote);
    return content.slice(getFrontMatterInfo(content).contentStart);
  }

  private navigate(action: NavigationAction): void {
    invokeAsyncSafely(() => this.siblingNavigator.navigate(action, { item: this._folder, leaf: this.leaf }));
  }

  /**
   * Opens an item when its element is clicked: in this leaf, or in a new tab, split or window with a
   * modifier key or a middle click, as a link would.
   *
   * @param el - The element.
   * @param item - The item.
   */
  private openOnClick(el: HTMLElement, item: TAbstractFile): void {
    const open = (mouseEvent: MouseEvent): void => {
      mouseEvent.preventDefault();
      const paneType = Keymap.isModEvent(mouseEvent);
      const leaf = paneType ? this.app.workspace.getLeaf(paneType) : this.leaf;
      invokeAsyncSafely(() => this.siblingNavigator.open(item, leaf));
    };
    el.addEventListener('click', open);
    el.addEventListener('auxclick', (mouseEvent) => {
      if (mouseEvent.button === MIDDLE_BUTTON) {
        open(mouseEvent);
      }
    });
  }

  private refreshBars(): void {
    const { bottomBar, pageEl, topBar } = this;
    if (!pageEl || !topBar || !bottomBar) {
      return;
    }
    const { showBottomBar, showTopBar } = this.getSettings();
    if (showTopBar) {
      pageEl.prepend(topBar.el);
    } else {
      topBar.el.detach();
    }
    if (showBottomBar) {
      pageEl.append(bottomBar.el);
    } else {
      bottomBar.el.detach();
    }

    const folder = this._folder;
    const state = {
      isAvailable: (action: NavigationAction): boolean => this.siblingNavigator.getTarget(action, folder) !== null,
      position: this.siblingNavigator.getPosition(folder)
    };
    topBar.update(state);
    bottomBar.update(state);
  }

  private refreshFolderNote(isChanged: boolean): void {
    const folderNoteEl = this.folderNoteEl;
    if (!folderNoteEl) {
      return;
    }
    const folderNote = this._folder ? findFolderNote(this.app, this._folder, this.getSettings()) : null;
    if (folderNote === this.renderedFolderNote && folderNote?.path === this.renderedFolderNotePath && !isChanged) {
      return;
    }

    this.unloadFolderNote();
    folderNoteEl.empty();
    this.renderedFolderNote = folderNote;
    this.renderedFolderNotePath = folderNote?.path ?? null;
    if (!folderNote) {
      return;
    }

    const titleEl = folderNoteEl.createEl('a', {
      cls: VirtualFolderNoteViewCssClass.FolderNoteTitle,
      href: '#',
      text: folderNote.basename
    });
    this.openOnClick(titleEl, folderNote);

    const bodyEl = folderNoteEl.createDiv({ cls: ['markdown-rendered', VirtualFolderNoteViewCssClass.FolderNoteBody] });
    const component = new Component();
    this.renderedFolderNoteComponent = component;
    this.addChild(component);
    const renderVersion = ++this.renderVersion;
    invokeAsyncSafely(async () => {
      const markdown = await this.getFolderNoteMarkdown(folderNote);
      if (renderVersion !== this.renderVersion) {
        return;
      }
      await fullRender({
        app: this.app,
        component,
        el: bodyEl,
        markdown,
        shouldRegisterLinkHandlers: true,
        sourcePath: folderNote.path
      });
    });
  }

  private refreshItems(): void {
    const { enterButton, inlineTitleEl, itemsEl } = this;
    if (!itemsEl || !enterButton || !inlineTitleEl) {
      return;
    }
    const folder = this._folder;
    inlineTitleEl.setText(folder?.name ?? 'This folder no longer exists.');
    itemsEl.empty();

    const items = folder ? getFolderSequence(this.app, folder) : [];
    enterButton.disabled = items.length === 0;
    enterButton.toggle(folder !== null);
    if (folder && items.length === 0) {
      itemsEl.createDiv({ cls: VirtualFolderNoteViewCssClass.Empty, text: 'This folder is empty.' });
    }

    for (const item of items) {
      const itemEl = itemsEl.createEl('a', {
        attr: { 'data-path': item.path },
        cls: VirtualFolderNoteViewCssClass.Item,
        href: '#'
      });
      setIcon(itemEl.createSpan({ cls: VirtualFolderNoteViewCssClass.ItemIcon }), item instanceof TFolder ? FOLDER_ICON : FILE_ICON);
      itemEl.createSpan({ text: getItemDisplayName(item) });
      this.openOnClick(itemEl, item);
    }
  }

  private unloadFolderNote(): void {
    this.renderVersion++;
    if (this.renderedFolderNoteComponent) {
      this.removeChild(this.renderedFolderNoteComponent);
      this.renderedFolderNoteComponent = null;
    }
    this.renderedFolderNote = null;
    this.renderedFolderNotePath = null;
  }
}

/**
 * Names an item the way the File explorer does: a Markdown note without its extension, anything else
 * with it.
 *
 * @param item - The item.
 * @returns The name.
 */
function getItemDisplayName(item: TAbstractFile): string {
  return item instanceof TFile && item.extension === MARKDOWN_FILE_EXTENSION ? item.basename : item.name;
}

function isVirtualFolderNoteViewState(state: unknown): state is VirtualFolderNoteViewState {
  return typeof state === 'object' && state !== null && 'folderPath' in state && typeof state.folderPath === 'string';
}
