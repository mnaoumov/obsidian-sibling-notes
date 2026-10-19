import type { FileExplorerView } from '@obsidian-typings/obsidian-public-latest';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// Desktop-only: the commands read the same File explorer on mobile, and nothing here is platform-specific
// Beyond driving that explorer.
// Isolation: `npx vitest run --project integration-tests:desktop src/folder-navigation.desktop.integration.test.ts`.

interface NavigationResult {
  readonly availableAtLast: string[];
  readonly fallbackNext: null | string;
  readonly visited: string[];
}

const FOLDER = 'sn-navigation';

describe('folder navigation commands', () => {
  it('follow the File explorer\'s sort order, open subfolders as virtual folder notes, enter and leave them, and fall back to name order', async () => {
    const result = await evalInObsidian({
      async callback({ app, folder, lib: { waitUntil } }): Promise<NavigationResult> {
        const WAIT_TIMEOUT_IN_MILLISECONDS = 2000;
        const PLUGIN_ID = 'sibling-notes';
        const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';
        const visited: string[] = [];

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
        const fileExplorerView = leaf.view as FileExplorerView;
        // Reversed, the explorer shows `sub`, `c.md`, `b.md`, `a.md`: folders stay on top.
        fileExplorerView.setSortOrder('alphabeticalReverse');

        try {
          await openFile(`${folder}/a.md`);
          const availableAtLast = ['go-to-next', 'go-to-last', 'go-page-down', 'go-to-previous', 'go-to-first', 'go-page-up', 'go-up', 'enter-folder']
            .filter((id) => isAvailable(id));

          await step('go-to-previous', `${folder}/b.md`);
          await step('go-to-first', `${folder}/sub`);
          await step('enter-folder', `${folder}/sub/x.md`);
          await step('go-up', `${folder}/sub`);
          await step('go-to-next', `${folder}/c.md`);
          await step('go-to-last', `${folder}/a.md`);
          await step('go-page-up', `${folder}/sub`);
          await step('go-up', folder);

          app.internalPlugins.getPluginById('file-explorer')?.disable(true);
          await openFile(`${folder}/a.md`);
          const fallbackNext = getTarget('go-to-next');
          return { availableAtLast, fallbackNext, visited };
        } finally {
          await app.internalPlugins.getPluginById('file-explorer')?.enable(true);
          const explorerLeaf = app.workspace.getLeavesOfType('file-explorer')[0];
          await explorerLeaf?.loadIfDeferred();
          (explorerLeaf?.view as FileExplorerView | undefined)?.setSortOrder('alphabetical');
          const folderFile = app.vault.getFolderByPath(folder);
          if (folderFile) {
            await app.fileManager.trashFile(folderFile);
          }
        }

        // A landed file is the active one. A landed subfolder is the folder of the active virtual folder note.
        function getActivePath(): string {
          const view = app.workspace.getMostRecentLeaf()?.view;
          if (view?.getViewType() === VIRTUAL_FOLDER_NOTE_VIEW_TYPE) {
            const { folderPath } = view.getState();
            return typeof folderPath === 'string' ? folderPath : '';
          }
          return app.workspace.getActiveFile()?.path ?? '';
        }

        function getTarget(id: string): null | string {
          return isAvailable(id) ? id : null;
        }

        function isAvailable(id: string): boolean {
          return app.commands.findCommand(`${PLUGIN_ID}:${id}`)?.checkCallback?.(true) === true;
        }

        async function openFile(path: string): Promise<void> {
          const file = app.vault.getFileByPath(path);
          if (!file) {
            throw new Error(`No file ${path}.`);
          }
          await app.workspace.getLeaf(false).openFile(file);
          await waitFor(`${path} to open`, () => app.workspace.getActiveFile() === file);
        }

        async function step(id: string, expectedPath: string): Promise<void> {
          if (!app.commands.executeCommandById(`${PLUGIN_ID}:${id}`)) {
            throw new Error(`The command ${id} is unavailable.`);
          }
          await waitFor(`${id} to land on ${expectedPath}`, () => getActivePath() === expectedPath);
          visited.push(getActivePath());
        }

        async function waitFor(description: string, isReady: () => boolean): Promise<void> {
          try {
            await waitUntil({ predicate: isReady, timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS });
          } catch (error) {
            throw new Error(`Timed out waiting for ${description}; at ${getActivePath()}.`, { cause: error });
          }
        }
      },
      input: { folder: FOLDER },
      vaultPath: getTemporaryVault().path
    });

    expect(result.availableAtLast).toStrictEqual(['go-to-previous', 'go-to-first', 'go-page-up', 'go-up']);
    expect(result.visited).toStrictEqual([
      `${FOLDER}/b.md`,
      `${FOLDER}/sub`,
      `${FOLDER}/sub/x.md`,
      `${FOLDER}/sub`,
      `${FOLDER}/c.md`,
      `${FOLDER}/a.md`,
      `${FOLDER}/sub`,
      FOLDER
    ]);
    // In name order `a.md` is no longer last, so Next is offered again.
    expect(result.fallbackNext).toBe('go-to-next');
  });
});
