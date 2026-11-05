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

// Desktop-only: the commands read the same File explorer on mobile, and nothing here is platform-specific
// Beyond driving that explorer.
// Isolation: `npx vitest run --project integration-tests:desktop src/navigation/folder-navigation.desktop.integration.test.ts`.
//
// Each step is its own short closure that awaits the open its command starts, and every landing is awaited in Node
// Through `pollInObsidian`, because on a loaded machine a landing can take seconds.

interface ReadActivePathParams extends CommonArguments {
  readonly viewType: string;
}

const FOLDER = 'sn-navigation';
const PLUGIN_ID = 'sibling-notes';
const POLL_TIMEOUT_IN_MILLISECONDS = 20_000;
const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';

/**
 * Ten waits of up to {@link POLL_TIMEOUT_IN_MILLISECONDS} each, so the desktop project's 30 s default would end a slow
 * run with a bare vitest timeout before the stalled step's own wait could name it.
 */
const TEST_TIMEOUT_IN_MILLISECONDS = 240_000;

const COMMAND_IDS = ['go-to-next', 'go-to-last', 'go-page-down', 'go-to-previous', 'go-to-first', 'go-page-up', 'go-up', 'enter-folder'];

describe('folder navigation commands', () => {
  it(
    'follow the File explorer\'s sort order, open subfolders as virtual folder notes, enter and leave them, and fall back to name order',
    { timeout: TEST_TIMEOUT_IN_MILLISECONDS },
    async () => {
      const vaultPath = getTemporaryVault().path;

      async function waitForActivePath(description: string, expectedPath: string): Promise<string> {
        let lastActivePath = '';
        try {
          return await pollInObsidian({
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

      async function openFile(path: string): Promise<void> {
        await evalInObsidian({
          async callback({ app, path: filePath }): Promise<void> {
            const file = app.vault.getFileByPath(filePath);
            if (!file) {
              throw new Error(`No file ${filePath}.`);
            }
            await app.workspace.getLeaf(false).openFile(file);
          },
          input: { path },
          vaultPath
        });
        await waitForActivePath(`${path} to open`, path);
      }

      async function getAvailableCommands(): Promise<string[]> {
        return evalInObsidian({
          callback({ app, commandIds, pluginId }): string[] {
            return commandIds.filter((id) => app.commands.findCommand(`${pluginId}:${id}`)?.checkCallback?.(true) === true);
          },
          input: { commandIds: COMMAND_IDS, pluginId: PLUGIN_ID },
          vaultPath
        });
      }

      const visited: string[] = [];

      async function step(id: string, expectedPath: string): Promise<void> {
        const isExecuted = await evalInObsidian({
          async callback({ app, commandId, lib: { waitUntil }, obsidianModule }): Promise<boolean> {
            // A leaf ignores `setViewState` while it is still working on the previous one, and the active file
            // Changes before that work ends. So the step waits for the open its command starts, not only for the
            // Landing, or the next command can be dropped. That race is what failed this test on a loaded machine.
            const START_TIMEOUT_IN_MILLISECONDS = 5000;
            const leafPrototype = obsidianModule.WorkspaceLeaf.prototype;
            const originalSetViewState = leafPrototype.setViewState;
            const opens: Promise<void>[] = [];
            leafPrototype.setViewState = function setViewState(this: typeof leafPrototype, ...setViewStateArguments): Promise<void> {
              const open = originalSetViewState.apply(this, setViewStateArguments);
              opens.push(open);
              return open;
            };
            function restoreSetViewState(): void {
              leafPrototype.setViewState = originalSetViewState;
            }
            try {
              if (!app.commands.executeCommandById(commandId)) {
                return false;
              }
              await waitUntil({ predicate: () => opens.length > 0, timeoutInMilliseconds: START_TIMEOUT_IN_MILLISECONDS });
              await Promise.all(opens);
              return true;
            } finally {
              restoreSetViewState();
            }
          },
          input: { commandId: `${PLUGIN_ID}:${id}` },
          vaultPath
        });
        if (!isExecuted) {
          throw new Error(`The command ${id} is unavailable.`);
        }
        visited.push(await waitForActivePath(`${id} to land on ${expectedPath}`, expectedPath));
      }

      await evalInObsidian({
        async callback({ app, folder }): Promise<void> {
          await app.vault.createFolder(folder);
          await app.vault.createFolder(`${folder}/sub`);
          await app.vault.create(`${folder}/sub/x.md`, 'x');
          for (const name of ['a', 'b', 'c']) {
            await app.vault.create(`${folder}/${name}.md`, name);
          }

          const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
          if (!leaf) {
            throw new Error('No File explorer leaf.');
          }
          await leaf.loadIfDeferred();
          // Reversed, the explorer shows `sub`, `c.md`, `b.md`, `a.md`: folders stay on top.
          (leaf.view as FileExplorerView).setSortOrder('alphabeticalReverse');
        },
        input: { folder: FOLDER },
        vaultPath
      });

      try {
        await openFile(`${FOLDER}/a.md`);
        expect(await getAvailableCommands()).toStrictEqual(['go-to-previous', 'go-to-first', 'go-page-up', 'go-up']);

        await step('go-to-previous', `${FOLDER}/b.md`);
        await step('go-to-first', `${FOLDER}/sub`);
        await step('enter-folder', `${FOLDER}/sub/x.md`);
        await step('go-up', `${FOLDER}/sub`);
        await step('go-to-next', `${FOLDER}/c.md`);
        await step('go-to-last', `${FOLDER}/a.md`);
        await step('go-page-up', `${FOLDER}/sub`);
        await step('go-up', FOLDER);
        expect(visited).toStrictEqual([
          `${FOLDER}/b.md`,
          `${FOLDER}/sub`,
          `${FOLDER}/sub/x.md`,
          `${FOLDER}/sub`,
          `${FOLDER}/c.md`,
          `${FOLDER}/a.md`,
          `${FOLDER}/sub`,
          FOLDER
        ]);

        await evalInObsidian({
          callback({ app }): void {
            app.internalPlugins.getPluginById('file-explorer')?.disable(true);
          },
          vaultPath
        });
        await openFile(`${FOLDER}/a.md`);
        // In name order `a.md` is no longer last, so Next is offered again.
        expect(await getAvailableCommands()).toContain('go-to-next');
      } finally {
        await evalInObsidian({
          async callback({ app, folder }): Promise<void> {
            await app.internalPlugins.getPluginById('file-explorer')?.enable(true);
            const explorerLeaf = app.workspace.getLeavesOfType('file-explorer')[0];
            await explorerLeaf?.loadIfDeferred();
            (explorerLeaf?.view as FileExplorerView | undefined)?.setSortOrder('alphabetical');
            const folderFile = app.vault.getFolderByPath(folder);
            if (folderFile) {
              await app.fileManager.trashFile(folderFile);
            }
          },
          input: { folder: FOLDER },
          vaultPath
        });
      }
    }
  );
});

/**
 * Reads where navigation stands. A landed file is the active one. A landed subfolder is the folder of the active
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
