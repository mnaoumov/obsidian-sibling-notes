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
  it('follow the File explorer\'s sort order, land on subfolders, go up, and fall back to name order', async () => {
    const result = await evalInObsidian({
      async callback({ app, folder, lib: { waitUntil } }): Promise<NavigationResult> {
        const WAIT_TIMEOUT_IN_MILLISECONDS = 2000;
        const PLUGIN_ID = 'sibling-notes';
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
        const view = leaf.view as FileExplorerView;
        // Reversed, the explorer shows `sub`, `c.md`, `b.md`, `a.md`: folders stay on top.
        view.setSortOrder('alphabeticalReverse');

        try {
          await openFile(`${folder}/a.md`);
          const availableAtLast = ['go-to-next', 'go-to-last', 'go-page-down', 'go-to-previous', 'go-to-first', 'go-page-up', 'go-up']
            .filter((id) => isAvailable(id));

          run('go-to-previous');
          await waitFor('the previous note', () => getActivePath() === `${folder}/b.md`);
          visited.push(getActivePath());

          run('go-to-first');
          await waitFor('the subfolder', () => getFocusedFolderPath() === `${folder}/sub`);
          visited.push(getFocusedFolderPath());

          run('go-to-next');
          await waitFor('the note after the subfolder', () => getActivePath() === `${folder}/c.md`);
          visited.push(getActivePath());

          run('go-to-last');
          await waitFor('the last note', () => getActivePath() === `${folder}/a.md`);
          visited.push(getActivePath());

          await openFile(`${folder}/sub/x.md`);
          // Move the focus off the subfolder the earlier landing left it on, so this landing is seen afresh.
          const xItem = view.fileItems[`${folder}/sub/x.md`];
          if (!xItem) {
            throw new Error('No row for x.md.');
          }
          view.tree.setFocusedItem(xItem, false);
          run('go-up');
          await waitFor('the folder just left', () => getFocusedFolderPath() === `${folder}/sub`);
          visited.push(getFocusedFolderPath());

          run('go-page-down');
          await waitFor('a page down', () => getActivePath() === `${folder}/a.md`);
          visited.push(getActivePath());

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

        // A landed file is the active one. A landed subfolder is the File explorer's focused row.
        function getActivePath(): string {
          return app.workspace.getActiveFile()?.path ?? '';
        }

        function getFocusedFolderPath(): string {
          const explorerView = app.workspace.getLeavesOfType('file-explorer')[0]?.view as FileExplorerView | undefined;
          return explorerView?.tree.focusedItem?.file.path ?? '';
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

        function run(id: string): void {
          if (!app.commands.executeCommandById(`${PLUGIN_ID}:${id}`)) {
            throw new Error(`The command ${id} is unavailable.`);
          }
        }

        async function waitFor(step: string, isReady: () => boolean): Promise<void> {
          try {
            await waitUntil({ predicate: isReady, timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS });
          } catch (error) {
            throw new Error(`Timed out waiting for ${step}; at ${getActivePath()}.`, { cause: error });
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
      `${FOLDER}/c.md`,
      `${FOLDER}/a.md`,
      `${FOLDER}/sub`,
      `${FOLDER}/a.md`
    ]);
    // In name order `a.md` is no longer last, so Next is offered again.
    expect(result.fallbackNext).toBe('go-to-next');
  });
});
