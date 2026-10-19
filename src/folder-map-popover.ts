import {
  setIcon,
  setTooltip
} from 'obsidian';

/**
 * The CSS classes of the popover and of the bottom sheet, which share the header.
 */
export enum FolderMapContainerCssClass {
  Header = 'sibling-notes-folder-map-header',
  PinButton = 'sibling-notes-folder-map-pin',
  Popover = 'sibling-notes-folder-map-popover',
  Sheet = 'sibling-notes-folder-map-sheet',
  Title = 'sibling-notes-folder-map-title'
}

/**
 * Where a popover opens: below a rectangle, or above it when there is no room below.
 */
export interface FolderMapPopoverAnchor {
  readonly bottom: number;
  readonly doc: Document;

  /**
   * The element the popover opens from. A pointer-down on it does not close the popover, so the element's
   * own click can close it instead.
   */
  readonly el: HTMLElement | null;
  readonly left: number;
  readonly top: number;
}

interface FolderMapPopoverConstructorParams {
  readonly anchor: FolderMapPopoverAnchor;

  /**
   * The map's element, which the popover hosts.
   */
  readonly mapEl: HTMLElement;

  /**
   * Called once the popover has closed, however it closed.
   */
  readonly onClose: () => void;

  /**
   * Called when the pin button is clicked.
   */
  readonly onPin: () => void;
}

/**
 * The title of the map wherever it shows.
 */
export const FOLDER_MAP_TITLE = 'Folder map';

const ANCHOR_GAP_IN_PIXELS = 4;
const VIEWPORT_MARGIN_IN_PIXELS = 8;

/**
 * The folder map as a popover, on desktop. It rides Obsidian's `.menu` class for its background, border
 * and shadow.
 *
 * It closes on Escape, on a pointer-down anywhere outside it and its anchor, and when its owner closes it.
 */
export class FolderMapPopover {
  /**
   * The element the popover opened from, if any.
   */
  public get anchorEl(): HTMLElement | null {
    return this.params.anchor.el;
  }

  private readonly abortController = new AbortController();
  private readonly el: HTMLElement;
  private isClosed = false;
  private readonly params: FolderMapPopoverConstructorParams;

  public constructor(params: FolderMapPopoverConstructorParams) {
    this.params = params;
    const { doc } = params.anchor;
    this.el = doc.body.createDiv({ cls: ['menu', FolderMapContainerCssClass.Popover] });
    createFolderMapHeader(this.el, params.onPin);
    this.el.append(params.mapEl);

    const { signal } = this.abortController;
    doc.addEventListener('pointerdown', (pointerEvent) => {
      const path = pointerEvent.composedPath();
      if (!path.includes(this.el) && !(this.anchorEl && path.includes(this.anchorEl))) {
        this.close();
      }
    }, { capture: true, signal });
    doc.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') {
        return;
      }

      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.close();
    }, { capture: true, signal });

    this.position();
  }

  /**
   * Closes the popover. Closing it again does nothing.
   */
  public close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.abortController.abort();
    this.el.remove();
    this.params.onClose();
  }

  /**
   * Places the popover below its anchor, or above it when there is more room above, and keeps it inside
   * the window.
   */
  private position(): void {
    const { anchor } = this.params;
    const win = anchor.doc.defaultView ?? window;
    const height = this.el.offsetHeight;
    const roomBelow = win.innerHeight - anchor.bottom - ANCHOR_GAP_IN_PIXELS - VIEWPORT_MARGIN_IN_PIXELS;
    const roomAbove = anchor.top - ANCHOR_GAP_IN_PIXELS - VIEWPORT_MARGIN_IN_PIXELS;
    const isAbove = height > roomBelow && roomAbove > roomBelow;
    const top = isAbove ? anchor.top - ANCHOR_GAP_IN_PIXELS - height : anchor.bottom + ANCHOR_GAP_IN_PIXELS;
    const left = clampToWindow(anchor.left, win.innerWidth - this.el.offsetWidth);
    const clampedTop = clampToWindow(top, win.innerHeight - height);
    this.el.dataset['side'] = isAbove ? 'above' : 'below';
    this.el.setCssStyles({
      left: `${String(left)}px`,
      top: `${String(clampedTop)}px`
    });
  }
}

/**
 * Adds the map's title and its pin button.
 *
 * @param parentEl - The element to add them to.
 * @param onPin - Called when the pin button is clicked.
 * @returns The header's element.
 */
export function createFolderMapHeader(parentEl: HTMLElement, onPin: () => void): HTMLElement {
  const headerEl = parentEl.createDiv({ cls: FolderMapContainerCssClass.Header });
  headerEl.createDiv({ cls: FolderMapContainerCssClass.Title, text: FOLDER_MAP_TITLE });
  const pinLabel = 'Pin to the side panel';
  const pinButton = headerEl.createEl('button', {
    attr: { 'aria-label': pinLabel, 'type': 'button' },
    cls: ['clickable-icon', FolderMapContainerCssClass.PinButton]
  });
  setIcon(pinButton, 'pin');
  setTooltip(pinButton, pinLabel);
  pinButton.addEventListener('click', (clickEvent) => {
    clickEvent.preventDefault();
    onPin();
  });
  return headerEl;
}

/**
 * Keeps a coordinate inside the window, a margin away from its edges.
 *
 * @param value - The coordinate.
 * @param max - The largest coordinate that keeps the popover inside the window.
 * @returns The rounded coordinate.
 */
function clampToWindow(value: number, max: number): number {
  const upperBound = Math.max(VIEWPORT_MARGIN_IN_PIXELS, max - VIEWPORT_MARGIN_IN_PIXELS);
  return Math.round(Math.min(Math.max(value, VIEWPORT_MARGIN_IN_PIXELS), upperBound));
}
