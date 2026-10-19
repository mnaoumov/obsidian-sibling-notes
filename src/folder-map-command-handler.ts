import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { FolderMapComponent } from './folder-map-component.ts';

/**
 * What a folder map command does.
 */
export enum FolderMapCommand {
  /**
   * Pins the map to the side panel.
   */
  Pin = 'pin',

  /**
   * Shows the map of the current item's folder.
   */
  Show = 'show'
}

interface FolderMapCommandHandlerConstructorParams {
  readonly app: App;
  readonly command: FolderMapCommand;
  readonly folderMapComponent: FolderMapComponent;
}

const DEFINITIONS = {
  [FolderMapCommand.Pin]: { icon: 'pin', id: 'pin-folder-map', name: 'Pin the folder map to the side panel' },
  [FolderMapCommand.Show]: { icon: 'map', id: 'show-folder-map', name: 'Show the folder map' }
} as const;

/**
 * A folder map command. Showing the map is offered only while the main area shows a file or a folder;
 * pinning it always is.
 */
export class FolderMapCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly command: FolderMapCommand;
  private readonly folderMapComponent: FolderMapComponent;

  public constructor(params: FolderMapCommandHandlerConstructorParams) {
    super(DEFINITIONS[params.command]);
    this.app = params.app;
    this.command = params.command;
    this.folderMapComponent = params.folderMapComponent;
  }

  protected override canExecute(): boolean {
    return this.command === FolderMapCommand.Pin || this.folderMapComponent.getState(this.app.workspace.getMostRecentLeaf()) !== null;
  }

  protected override async execute(): Promise<void> {
    if (this.command === FolderMapCommand.Pin) {
      await this.folderMapComponent.pin();
      return;
    }
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (leaf) {
      await this.folderMapComponent.show(leaf, null);
    }
  }
}
