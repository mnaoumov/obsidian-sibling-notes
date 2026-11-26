import type { FileExplorerView } from '@obsidian-typings/obsidian-public-latest';
import type { CommonArguments } from 'obsidian-integration-testing';

import {
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// Desktop-only: the command deletes through Obsidian's own prompt on every platform, and nothing here is
// Platform-specific beyond driving the File explorer's order.
// Isolation: `npx vitest run --project integration-tests:desktop src/navigation/delete-and-go-to-next.desktop.integration.test.ts`.

interface DeletionConfig {
  readonly promptDelete: unknown;
  readonly trashOption: unknown;
}

interface ReadActivePathParams extends CommonArguments {
  readonly viewType: string;
}

const COMMAND_ID = 'sibling-notes:delete-and-go-to-next';
const FOLDER = 'sn-delete';
const POLL_TIMEOUT_IN_MILLISECONDS = 20_000;
const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';

/**
 * Seven waits of up to {@link POLL_TIMEOUT_IN_MILLISECONDS} each, so the desktop project's 30 s default would end a
 * slow run with a bare vitest timeout before the stalled wait could name it.
 */
const TEST_TIMEOUT_IN_MILLISECONDS = 180_000;

describe('delete and go to next command', () => {
  it(
    'deletes the current file and lands on the next item, the previous one at the end, and the emptied folder last',
    { timeout: TEST_TIMEOUT_IN_MILLISECONDS },
    async () => {
      const vaultPath = getTemporaryVault().path;

      async function waitForActivePath(description: string, expectedPath: string): Promise<void> {
        let lastActivePath = '';
        try {
          await pollInObsidian({
            input: { viewType: VIRTUAL_FOLDER_NOTE_VIEW_TYPE },
            poll: readActivePath,
            timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
            timeoutMessage: description,
            until: (activePath) => {
              lastActivePath = activePath;
              return activePath === expectedPath;
            },
            vaultPath
          });
        } catch (error) {
          throw new Error(`Timed out waiting for ${description}; at ${lastActivePath}.`, { cause: error });
        }
      }

      async function deleteAndExpect(deletedPath: string, expectedPath: string): Promise<void> {
        const isExecuted = await evalInObsidian({
          callback({ app, commandId }): boolean {
            return app.commands.executeCommandById(commandId);
          },
          input: { commandId: COMMAND_ID },
          vaultPath
        });
        expect(isExecuted).toBe(true);
        await waitForActivePath(`the deletion of ${deletedPath} to land on ${expectedPath}`, expectedPath);
        const doesExist = await evalInObsidian({
          callback({ app, path }): boolean {
            return app.vault.getAbstractFileByPath(path) !== null;
          },
          input: { path: deletedPath },
          vaultPath
        });
        expect(doesExist).toBe(false);
      }

      const originalConfig = await evalInObsidian({
        async callback({ app, folder }): Promise<DeletionConfig> {
          const config = { promptDelete: app.vault.getConfig('promptDelete'), trashOption: app.vault.getConfig('trashOption') };
          // No dialog to click, and a permanent delete, so the temporary vault leaves nothing in the system trash.
          app.vault.setConfig('promptDelete', false);
          app.vault.setConfig('trashOption', 'none');

          await app.vault.createFolder(folder);
          for (const name of ['a', 'b', 'c']) {
            await app.vault.create(`${folder}/${name}.md`, name);
          }

          const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
          if (!leaf) {
            throw new Error('No File explorer leaf.');
          }
          await leaf.loadIfDeferred();
          (leaf.view as FileExplorerView).setSortOrder('alphabetical');

          const file = app.vault.getFileByPath(`${folder}/b.md`);
          if (!file) {
            throw new Error('No file b.md.');
          }
          await app.workspace.getLeaf(false).openFile(file);
          return config;
        },
        input: { folder: FOLDER },
        vaultPath
      });

      try {
        await waitForActivePath('b.md to open', `${FOLDER}/b.md`);
        await deleteAndExpect(`${FOLDER}/b.md`, `${FOLDER}/c.md`);
        await deleteAndExpect(`${FOLDER}/c.md`, `${FOLDER}/a.md`);
        await deleteAndExpect(`${FOLDER}/a.md`, FOLDER);
      } finally {
        await evalInObsidian({
          async callback({ app, config, folder }): Promise<void> {
            app.vault.setConfig('promptDelete', config.promptDelete);
            app.vault.setConfig('trashOption', config.trashOption);
            const folderFile = app.vault.getFolderByPath(folder);
            if (folderFile) {
              await app.fileManager.trashFile(folderFile);
            }
          },
          input: { config: originalConfig, folder: FOLDER },
          vaultPath
        });
      }
    }
  );
});

/**
 * Reads where navigation stands. A landed file is the active one. A landed folder is the folder of the active
 * virtual folder note.
 *
 * @param params - The app and the virtual folder note's view type.
 * @returns The landed path.
 */
function readActivePath({ app, viewType }: ReadActivePathParams): string {
  const view = app.workspace.getMostRecentLeaf()?.view;
  if (view?.getViewType() === viewType) {
    const { folderPath } = view.getState();
    return typeof folderPath === 'string' ? folderPath : '';
  }
  return app.workspace.getActiveFile()?.path ?? '';
}
