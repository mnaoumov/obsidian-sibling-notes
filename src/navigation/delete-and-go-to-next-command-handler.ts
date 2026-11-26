import type {
  App,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';
import { retryWithTimeout } from '@mnaoumov/typescript-lib/async';
import { FileView } from 'obsidian';

import type { SiblingNavigator } from './sibling-navigator.ts';

const VIEW_REACTION_POLL_DELAY_IN_MILLISECONDS = 20;

interface DeleteAndGoToNextCommandHandlerConstructorParams {
  readonly app: App;
  readonly siblingNavigator: SiblingNavigator;
}

interface DeletionSubject {
  readonly file: TFile;
  readonly leaf: WorkspaceLeaf;
  readonly view: FileView;
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

    const { file, leaf, view } = subject;
    // The landing is read before the deletion, while the file still has its place in the sequence.
    const target = this.siblingNavigator.getTargetAfterRemoval(file);

    // A cancelled prompt changes nothing. `Delete unlinked attachments` can take the target with the file, and
    // Then Obsidian's default stands.
    if (!await this.app.fileManager.promptForDeletion(file) || !target || this.app.vault.getAbstractFileByPath(target.path) !== target) {
      return;
    }

    // The view reacts to the deletion on its own, from the vault event, by going back in the leaf's history or
    // Emptying the leaf, and the deletion does not wait for it. While that reaction loads, the leaf is working and
    // Ignores any other view state, so opening the target then would be dropped.
    await retryWithTimeout({
      operationFunction: () => !leaf.working && (leaf.view !== view || view.file !== file),
      operationName: 'Wait for the view to react to the deletion',
      retryOptions: { retryDelayInMilliseconds: VIEW_REACTION_POLL_DELAY_IN_MILLISECONDS }
    });

    await this.siblingNavigator.open(target, this.isInWorkspace(leaf) ? leaf : this.app.workspace.getLeaf(false));
  }

  private getDeletionSubject(): DeletionSubject | null {
    const view = this.app.workspace.getActiveViewOfType(FileView);
    const file = view?.file;
    return view && file?.parent ? { file, leaf: view.leaf, view } : null;
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
