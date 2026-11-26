import type {
  App,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';
import { FileView } from 'obsidian';

import type { SiblingNavigator } from './sibling-navigator.ts';

interface DeleteAndGoToNextCommandHandlerConstructorParams {
  readonly app: App;
  readonly siblingNavigator: SiblingNavigator;
}

interface DeletionSubject {
  readonly file: TFile;
  readonly leaf: WorkspaceLeaf;
}

/**
 * Deletes the active file and lands on the next item of its folder, or the previous one when it was the
 * last, or the folder's virtual folder note when it was the only one, instead of Obsidian's default of
 * going back to the last opened file.
 *
 * The deletion goes through Obsidian's own prompt, so the user's `Confirm file deletion`, `Deleted files`
 * and `Delete unlinked attachments` settings apply as they do for the core delete. A cancelled prompt
 * changes nothing. A virtual folder note stands for a folder, so the command is not offered there.
 */
export class DeleteAndGoToNextCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly siblingNavigator: SiblingNavigator;

  public constructor(params: DeleteAndGoToNextCommandHandlerConstructorParams) {
    super({
      icon: 'trash-2',
      id: 'delete-and-go-to-next',
      name: 'Delete the current file and go to the next item'
    });
    this.app = params.app;
    this.siblingNavigator = params.siblingNavigator;
  }

  protected override canExecute(): boolean {
    return this.getDeletionSubject() !== null;
  }

  protected override async execute(): Promise<void> {
    const subject = this.getDeletionSubject();
    if (!subject) {
      return;
    }

    const { file, leaf } = subject;
    // The landing is read before the deletion, while the file still has its place in the sequence.
    const target = this.siblingNavigator.getTargetAfterRemoval(file);
    // A cancelled prompt changes nothing. `Delete unlinked attachments` can take the target with the file, and
    // Then Obsidian's default stands.
    if (!await this.app.fileManager.promptForDeletion(file) || !target || this.app.vault.getAbstractFileByPath(target.path) !== target) {
      return;
    }

    await this.siblingNavigator.open(target, this.isInWorkspace(leaf) ? leaf : this.app.workspace.getLeaf(false));
  }

  private getDeletionSubject(): DeletionSubject | null {
    const view = this.app.workspace.getActiveViewOfType(FileView);
    const file = view?.file;
    return view && file?.parent ? { file, leaf: view.leaf } : null;
  }

  private isInWorkspace(leaf: WorkspaceLeaf): boolean {
    let isFound = false;
    this.app.workspace.iterateAllLeaves((workspaceLeaf) => {
      if (workspaceLeaf === leaf) {
        isFound = true;
      }
    });
    return isFound;
  }
}
