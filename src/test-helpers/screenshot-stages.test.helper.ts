/**
 * @file
 *
 * The staging closures the desktop and the Android capture suites share. Each frame is staged by `startStage`,
 * which sets it up and returns at once, and is read by `pollStage` until it shows what the frame needs, both
 * through `pollInObsidian`, so every wait happens in Node and no closure comes near the transport's per-eval cap.
 *
 * Both functions are serialized into Obsidian, so neither may reach anything outside its own body: every constant
 * and helper they use is declared inside them.
 */

import type {
  FileExplorerView,
  FileTreeItem,
  FolderTreeItem
} from '@obsidian-typings/obsidian-public-latest';
import type { CommonArguments } from 'obsidian-integration-testing';

/**
 * What {@link reserveCaptionBand} is given.
 */
export interface ReserveCaptionBandInput {
  /**
   * The height of the caption band `labelScreenshot` draws over the bottom of the frame.
   */
  readonly bandHeightInPixels: number;
}

/**
 * A frame the capture suites can stage.
 */
export type ScreenshotStage = 'bottom-bar' | 'map' | 'pinned-map' | 'settings' | 'top-bar' | 'virtual-folder-note';

/**
 * What a stage closure is given.
 */
export interface StageInput {
  /**
   * The frame to stage.
   */
  readonly stage: ScreenshotStage;
}

/**
 * Reads whether the metadata cache has resolved the links of every note.
 *
 * Until it has, the status bar's count of links to the open note is still climbing, so a frame taken earlier differs
 * from one taken on the next run.
 *
 * @param params - The closure arguments.
 * @returns Whether every note's links are resolved.
 */
export function areAllLinksResolved({ app }: CommonArguments): boolean {
  return app.vault.getMarkdownFiles().every((file) => Object.hasOwn(app.metadataCache.resolvedLinks, file.path));
}

/**
 * Reads whether the staged frame is ready, and what it shows.
 *
 * @param params - The closure arguments.
 * @returns What the frame shows, or an empty string while it is not ready.
 */
export function pollStage({ app, stage }: CommonArguments & StageInput): string {
  const PLUGIN_ID = 'sibling-notes';
  const FOLDER_MAP_VIEW_TYPE = 'sibling-notes-folder-map';
  const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';

  const readers: Record<ScreenshotStage, () => string> = {
    'bottom-bar': () => isBottomBarInView() ? readPosition('bottom') : '',
    'map': () => {
      const mapEl = activeDocument.querySelector(':scope :is(.sibling-notes-folder-map-popover, .sibling-notes-folder-map-sheet) .sibling-notes-folder-map');
      return mapEl ? `${readNames(mapEl, '.is-active')} -> ${readNames(mapEl, '.is-targeted')}` : '';
    },
    'pinned-map': () => {
      const mapEl = app.workspace.getLeavesOfType(FOLDER_MAP_VIEW_TYPE)[0]?.view.containerEl.querySelector(':scope .sibling-notes-folder-map');
      const isShown = !!mapEl && mapEl.getBoundingClientRect().width > 0 && isBottomBarInView();
      return isShown ? readNames(mapEl, '.is-active') : '';
    },
    'settings': () => app.setting.activeTab?.id === PLUGIN_ID && app.setting.activeTab.containerEl.querySelector('.setting-item-name') ? 'settings' : '',
    'top-bar': () => readPosition('top'),
    'virtual-folder-note': () => {
      const view = app.workspace.getMostRecentLeaf()?.view;
      if (view?.getViewType() !== VIRTUAL_FOLDER_NOTE_VIEW_TYPE) {
        return '';
      }
      const folderNoteText = view.containerEl.querySelector(':scope .sibling-notes-virtual-folder-note-folder-note-body')?.textContent ?? '';
      return folderNoteText.includes('The folder note of')
        ? view.containerEl.querySelector(':scope .sibling-notes-virtual-folder-note-title')?.textContent ?? ''
        : '';
    }
  };
  return readers[stage]();

  function getBar(placement: 'bottom' | 'top'): HTMLElement | null {
    const containerEl = app.workspace.getMostRecentLeaf()?.view.containerEl;
    // Until the note has rendered its heading, a bar can be in place above an empty preview.
    return containerEl?.querySelector(':scope .markdown-preview-view h1')
      ? containerEl.querySelector(`:scope .markdown-preview-view .sibling-notes-navigator-bar[data-placement="${CSS.escape(placement)}"]`)
      : null;
  }

  function isBottomBarInView(): boolean {
    const barEl = getBar('bottom');
    const scrollerEl = barEl?.closest('.markdown-preview-view');
    if (!barEl || !scrollerEl) {
      return false;
    }
    const barRect = barEl.getBoundingClientRect();
    const scrollerRect = scrollerEl.getBoundingClientRect();
    return barRect.height > 0 && barRect.top >= scrollerRect.top && barRect.bottom <= scrollerRect.bottom;
  }

  function readNames(mapEl: Element, selector: string): string {
    return Array.from(mapEl.querySelectorAll(`:scope .sibling-notes-folder-map-item${selector} .sibling-notes-folder-map-item-name`), (el) => el.textContent)
      .join(', ');
  }

  function readPosition(placement: 'bottom' | 'top'): string {
    return getBar(placement)?.querySelector('.sibling-notes-navigator-bar-position')?.textContent ?? '';
  }
}

/**
 * Lays the app out above the caption band rather than under it.
 *
 * `labelScreenshot` draws its band over the bottom of the frame, on the grounds that the bottom is chrome. Here the
 * bottom bar and the bottom sheet sit there, so the band would hide what two of the frames are about.
 *
 * @param params - The closure arguments.
 */
export function reserveCaptionBand({ bandHeightInPixels, obsidianModule }: CommonArguments & ReserveCaptionBandInput): void {
  /*
   * The band is measured in the frame's pixels. A desktop frame is shot at one CSS pixel per pixel, but a phone's is
   * its framebuffer, at the device's pixel ratio.
   */
  const pixelRatio = obsidianModule.Platform.isMobile ? activeWindow.devicePixelRatio : 1;
  const band = `${String(bandHeightInPixels / pixelRatio)}px`;
  activeDocument.querySelector<HTMLElement>(':scope .app-container')?.setCssStyles({ height: `calc(100% - ${band})` });
  // The status bar and a phone's navigation bar are fixed to the viewport rather than laid out in the app, so they are
  // Lifted on their own.
  for (const el of activeDocument.querySelectorAll<HTMLElement>(':scope :is(.status-bar, .mobile-navbar)')) {
    el.setCssStyles({ bottom: band });
  }
  // So is the bottom sheet, which exists only while it is open, so its stage reads the band's height from here.
  activeDocument.body.setCssProps({ '--sibling-notes-caption-band': band });
}

/**
 * Stages a frame: dismisses whatever the last frame left open, opens what the frame is about, and sets the File
 * explorer up for it.
 *
 * @param params - The closure arguments.
 */
export async function startStage({ app, lib, obsidianModule, stage }: CommonArguments & StageInput): Promise<void> {
  const PLUGIN_ID = 'sibling-notes';
  const FOLDER_MAP_VIEW_TYPE = 'sibling-notes-folder-map';
  const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';
  const FOLDER = 'Materials/01 Folder navigation';
  const NOTE_PATH = `${FOLDER}/Chapter 2.md`;
  const APPENDIX_FOLDER = `${FOLDER}/Appendix`;
  const WAIT_TIMEOUT_IN_MILLISECONDS = 10_000;
  const { isMobile } = obsidianModule.Platform;

  await dismissLeftovers();

  if (stage !== 'pinned-map') {
    app.workspace.detachLeavesOfType(FOLDER_MAP_VIEW_TYPE);
    if (!isMobile) {
      app.workspace.rightSplit.collapse();
    }
  }

  if (!isMobile) {
    await showInExplorer(stage === 'virtual-folder-note' ? [APPENDIX_FOLDER] : []);
  }

  switch (stage) {
    case 'bottom-bar': {
      await openNote();
      await scrollToBottomBar();
      break;
    }
    case 'map': {
      await openNote();
      const mapButton = await waitForElement(getTopBarSelector('map'));
      await lib.clickElement({ element: mapButton });
      await lib.waitUntil({
        message: 'the folder map to open',
        predicate: () => activeDocument.querySelector(':scope :is(.sibling-notes-folder-map-popover, .sibling-notes-folder-map-sheet)') !== null,
        timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      });
      // The sheet is fixed to the viewport's bottom edge, and did not exist yet when `reserveCaptionBand` ran.
      activeDocument.querySelector<HTMLElement>(':scope .sibling-notes-folder-map-sheet')?.setCssStyles({ bottom: 'var(--sibling-notes-caption-band)' });
      // A phone has no hover, so only the desktop frame shows a hovered button's target.
      if (!isMobile) {
        await lib.hoverElement({ element: await waitForElement(getTopBarSelector('next')) });
      }
      break;
    }
    case 'pinned-map': {
      await openNote();
      app.commands.executeCommandById(`${PLUGIN_ID}:pin-folder-map`);
      await lib.waitUntil({
        message: 'the pinned folder map',
        predicate: () => app.workspace.getLeavesOfType(FOLDER_MAP_VIEW_TYPE).length > 0,
        timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      });
      app.workspace.rightSplit.expand();
      const pinnedLeaf = app.workspace.getLeavesOfType(FOLDER_MAP_VIEW_TYPE)[0];
      if (pinnedLeaf) {
        await app.workspace.revealLeaf(pinnedLeaf);
      }
      // Revealing the side panel makes it the active leaf, and the pinned map follows the main area's most recent one.
      const noteLeaf = app.workspace.getLeavesOfType('markdown')[0];
      if (noteLeaf) {
        app.workspace.setActiveLeaf(noteLeaf, { focus: false });
      }
      await scrollToBottomBar();
      break;
    }
    case 'settings': {
      // On mobile the settings modal is not in the document until something attaches it.
      const { containerEl } = app.setting;
      if (!activeDocument.body.contains(containerEl)) {
        activeDocument.body.append(containerEl);
      }
      app.setting.open();
      app.setting.openTabById(PLUGIN_ID);
      // The tab keeps the scroll it had when it was last open, which differs between runs.
      app.setting.activeTab?.containerEl.scrollTo({ top: 0 });
      break;
    }
    case 'top-bar': {
      await openNote();
      break;
    }
    case 'virtual-folder-note': {
      await app.workspace.getLeaf(false).setViewState({
        active: true,
        state: { folderPath: APPENDIX_FOLDER },
        type: VIRTUAL_FOLDER_NOTE_VIEW_TYPE
      });
      break;
    }
    default: {
      break;
    }
  }

  async function dismissLeftovers(): Promise<void> {
    if (activeDocument.body.contains(app.setting.containerEl)) {
      app.setting.close();
    }
    // Both the popover and the bottom sheet close on Escape.
    if (activeDocument.querySelector(':scope :is(.sibling-notes-folder-map-popover, .modal-container)')) {
      activeDocument.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }));
    }
    await lib.waitUntil({
      message: 'the last frame\'s map or modal to close',
      predicate: () => activeDocument.querySelector(':scope :is(.sibling-notes-folder-map-popover, .modal-container)') === null,
      timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
    });
    if (!isMobile) {
      const nextButton = activeDocument.querySelector(`:scope ${getTopBarSelector('next')}`);
      if (nextButton instanceof HTMLElement) {
        await lib.unhoverElement({ element: nextButton });
      }
    }
    for (const el of activeDocument.querySelectorAll(':scope .menu, :scope .notice, :scope .tooltip')) {
      el.detach();
    }
  }

  function getTopBarSelector(action: string): string {
    return `.markdown-preview-view .sibling-notes-navigator-bar[data-placement="top"] button[data-action="${action}"]`;
  }

  function isFolderItem(item: FileTreeItem | FolderTreeItem): item is FolderTreeItem {
    return 'vChildren' in item;
  }

  async function openNote(): Promise<void> {
    await app.workspace.getLeaf(false).setViewState({ active: true, state: { file: NOTE_PATH, mode: 'preview' }, type: 'markdown' });
    const scrollerEl = await waitForElement('.markdown-preview-view');
    scrollerEl.scrollTop = 0;
  }

  async function scrollToBottomBar(): Promise<void> {
    const barEl = await waitForElement('.markdown-preview-view .sibling-notes-navigator-bar[data-placement="bottom"]');
    barEl.scrollIntoView({ block: 'center' });
  }

  /**
   * Expands the walkthrough folder and the given extra folders, collapses every other one, and shows the explorer.
   */
  async function showInExplorer(extraExpandedPaths: readonly string[]): Promise<void> {
    const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
    if (!leaf) {
      throw new Error('No File explorer leaf.');
    }
    await leaf.loadIfDeferred();
    app.workspace.leftSplit.expand();
    await app.workspace.revealLeaf(leaf);
    const view = leaf.view as FileExplorerView;
    const expandedPaths = new Set([FOLDER, 'Materials', ...extraExpandedPaths]);
    for (const item of Object.values(view.fileItems)) {
      if (isFolderItem(item) && item.file.path !== '/') {
        await item.setCollapsed(!expandedPaths.has(item.file.path));
      }
    }
  }

  async function waitForElement(selector: string): Promise<HTMLElement> {
    await lib.waitUntil({
      message: selector,
      predicate: () => findElement(selector) !== null,
      timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
    });
    const el = findElement(selector);
    if (!el) {
      throw new Error(`No ${selector}.`);
    }
    return el;
  }

  function findElement(selector: string): HTMLElement | null {
    const el = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(`:scope ${selector}`);
    return el instanceof HTMLElement ? el : null;
  }
}
