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

// Isolation: `npx vitest run --project integration-tests:desktop src/folder-map-hover.desktop.integration.test.ts`.
//
// Desktop only: hovering is a mouse gesture, and the trusted hover helpers reach the app through Electron.

interface PopoverTargets {
  readonly isOpen: boolean;
  readonly paths: string[];
}

const FOLDER = 'sn-map-hover';
const POLL_TIMEOUT_IN_MILLISECONDS = 20_000;

describe('folder map hover', () => {
  it('highlights in the map the target of a hovered bar button, and clears it when the button is left', async () => {
    const vaultPath = getTemporaryVault().path;

    async function readTargeted(step: string, isReady: (paths: string[]) => boolean): Promise<string[]> {
      const state = await pollInObsidian({
        poll(): PopoverTargets {
          const mapEl = activeDocument.body.querySelector('.sibling-notes-folder-map-popover');
          return {
            isOpen: mapEl !== null,
            paths: mapEl ? Array.from(mapEl.querySelectorAll<HTMLElement>('.is-targeted'), (el) => el.dataset['path'] ?? '') : []
          };
        },
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: step,
        until: ({ isOpen, paths }) => isOpen && isReady(paths),
        vaultPath
      });
      return state.paths;
    }

    async function hoverBarButton(action: string, isHovered: boolean): Promise<void> {
      await evalInObsidian({
        async callback({ action: actionName, app, isHovered: shouldHover, lib: { hoverElement, unhoverElement } }): Promise<void> {
          const button = app.workspace.getMostRecentLeaf()?.view.containerEl
            .querySelector(`.sibling-notes-navigator-bar[data-placement="top"] button[data-action="${CSS.escape(actionName)}"]`);
          if (!(button instanceof HTMLElement)) {
            throw new TypeError(`No ${actionName} button.`);
          }
          await (shouldHover ? hoverElement({ element: button }) : unhoverElement({ element: button }));
        },
        input: { action, isHovered },
        vaultPath
      });
    }

    await evalInObsidian({
      async callback({ app, folder, lib: { clickElement, waitUntil } }): Promise<void> {
        await app.vault.createFolder(folder);
        for (const name of ['a', 'b', 'c']) {
          await app.vault.create(`${folder}/${name}.md`, `${name}\n`);
        }
        const file = app.vault.getFileByPath(`${folder}/b.md`);
        if (!file) {
          throw new Error('No b.md.');
        }
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file, { state: { mode: 'source' } });
        const selector = '.sibling-notes-navigator-bar[data-placement="top"] button[data-action="map"]';
        await waitUntil({
          message: 'the top bar\'s Map button',
          predicate: () => leaf.view.containerEl.querySelector(selector) !== null,
          timeoutInMilliseconds: 10_000
        });
        const mapButton = leaf.view.containerEl.querySelector(selector);
        if (!(mapButton instanceof HTMLElement)) {
          throw new TypeError('No Map button.');
        }
        await clickElement({ element: mapButton });
      },
      input: { folder: FOLDER },
      vaultPath
    });

    try {
      expect(await readTargeted('the popover to open', (paths) => paths.length === 0)).toStrictEqual([]);
      await hoverBarButton('next', true);
      expect(await readTargeted('Next\'s target', (paths) => paths.length > 0)).toStrictEqual([`${FOLDER}/c.md`]);
      await hoverBarButton('up', true);
      expect(await readTargeted('Up\'s target', (paths) => paths.includes(FOLDER))).toStrictEqual([FOLDER]);
      await hoverBarButton('up', false);
      expect(await readTargeted('the highlight to clear', (paths) => paths.length === 0)).toStrictEqual([]);
    } finally {
      await evalInObsidian({
        async callback({ app, folder }): Promise<void> {
          activeDocument.body.querySelector('.sibling-notes-folder-map-popover')?.remove();
          const folderFile = app.vault.getFolderByPath(folder);
          if (folderFile) {
            await app.fileManager.trashFile(folderFile);
          }
        },
        input: { folder: FOLDER },
        vaultPath
      });
    }
  });
});
