import type { App } from 'obsidian';

import { Modal } from 'obsidian';

import {
  createFolderMapHeader,
  FolderMapContainerCssClass
} from './folder-map-popover.ts';

interface FolderMapSheetConstructorParams {
  readonly app: App;

  /**
   * The map's element, which the sheet hosts.
   */
  readonly mapEl: HTMLElement;

  /**
   * Called once the sheet has closed, however it closed.
   */
  readonly onClose: () => void;

  /**
   * Called when the pin button is clicked.
   */
  readonly onPin: () => void;
}

/**
 * The folder map as a bottom sheet, on mobile: a modal restyled to rise from the bottom edge. Being a
 * modal, it closes on the back gesture, on a tap outside it and on its close button, as any other does.
 */
export class FolderMapSheet extends Modal {
  /**
   * A sheet opens from no element of its own.
   */
  public readonly anchorEl = null;

  private readonly params: FolderMapSheetConstructorParams;

  public constructor(params: FolderMapSheetConstructorParams) {
    super(params.app);
    this.params = params;
    this.modalEl.addClass(FolderMapContainerCssClass.Sheet);
  }

  public override onClose(): void {
    super.onClose();
    this.params.onClose();
  }

  public override onOpen(): void {
    super.onOpen();
    createFolderMapHeader(this.contentEl, this.params.onPin);
    this.contentEl.append(this.params.mapEl);
  }
}
