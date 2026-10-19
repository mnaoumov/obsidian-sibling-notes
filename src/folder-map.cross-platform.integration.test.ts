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

// Isolation: `npx vitest run --project integration-tests:desktop src/folder-map.cross-platform.integration.test.ts`,
// Or `--project integration-tests:android`.
//
// Each step is its own short closure, and every wait runs in Node through `pollInObsidian`, because a cold
// Android emulator can take seconds to render a note.

interface MapSnapshot {
  readonly active: string[];
  readonly breadcrumbs: string[];
  readonly items: string[];
  readonly targets: Record<string, string[]>;
}

interface MapState {
  readonly activePath: string;
  readonly container: '' | 'popover' | 'sheet';
  readonly hasMapButton: boolean;
  readonly isMobile: boolean;
  readonly pinned: MapSnapshot | null;
  readonly transient: MapSnapshot | null;
}

const FOLDER = 'sn-map';
const POLL_TIMEOUT_IN_MILLISECONDS = 20_000;
const FOLDER_MAP_VIEW_TYPE = 'sibling-notes-folder-map';

describe('folder map', () => {
  it('opens from the bar as a popover or a sheet, shows the folder with each button\'s target, goes to a clicked item, enters a subfolder, and pins', async () => {
    const vaultPath = getTemporaryVault().path;

    async function waitForState(step: string, isReady: (state: MapState) => boolean): Promise<MapState> {
      return pollInObsidian({
        poll: readState,
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: step,
        until: isReady,
        vaultPath
      });
    }

    async function click(selector: string, isInLeaf: boolean): Promise<void> {
      await evalInObsidian({
        async callback({ app, isInLeaf: isInMostRecentLeaf, lib: { clickElement }, selector: elementSelector }): Promise<void> {
          const rootEl = isInMostRecentLeaf ? app.workspace.getMostRecentLeaf()?.view.containerEl : activeDocument.body;
          const el = rootEl?.querySelector(elementSelector);
          if (!(el instanceof HTMLElement)) {
            throw new TypeError(`No ${elementSelector}.`);
          }
          await clickElement({ element: el });
        },
        input: { isInLeaf, selector },
        vaultPath
      });
    }

    async function openMapFromTopBar(): Promise<void> {
      await click('.sibling-notes-navigator-bar[data-placement="top"] button[data-action="map"]', true);
    }

    function clickTransientItem(path: string): Promise<void> {
      return click(`:is(.sibling-notes-folder-map-popover, .sibling-notes-folder-map-sheet) .sibling-notes-folder-map-item[data-path="${path}"]`, false);
    }

    await evalInObsidian({
      async callback({ app, folder }): Promise<void> {
        await app.vault.createFolder(folder);
        await app.vault.createFolder(`${folder}/sub`);
        await app.vault.create(`${folder}/sub/inner.md`, 'Inner\n');
        for (const name of ['a', 'b', 'c']) {
          await app.vault.create(`${folder}/${name}.md`, `${name}\n`);
        }
        const file = app.vault.getFileByPath(`${folder}/b.md`);
        if (!file) {
          throw new Error('No b.md.');
        }
        await app.workspace.getLeaf(false).openFile(file, { state: { mode: 'source' } });
      },
      input: { folder: FOLDER },
      vaultPath
    });

    try {
      await waitForState('b.md to open with its bars', (state) => state.activePath === `${FOLDER}/b.md` && state.hasMapButton);
      await openMapFromTopBar();
      const opened = await waitForState('the map to open', (state) => state.transient !== null);
      expect(opened.container).toBe(opened.isMobile ? 'sheet' : 'popover');
      expect(opened.transient?.breadcrumbs.slice(1)).toStrictEqual(['/', FOLDER]);
      expect(opened.transient?.items).toStrictEqual(['sub', 'a', 'b', 'c']);
      expect(opened.transient?.active).toStrictEqual([`${FOLDER}/b.md`]);
      expect(opened.transient?.targets).toStrictEqual({
        [`${FOLDER}/a.md`]: ['previous'],
        [`${FOLDER}/c.md`]: ['next', 'pageDown', 'end'],
        [`${FOLDER}/sub`]: ['home', 'pageUp'],
        [FOLDER]: ['up']
      });

      await clickTransientItem(`${FOLDER}/c.md`);
      await waitForState('c.md to open from the map, and the map to close', (state) => state.activePath === `${FOLDER}/c.md` && state.container === '');

      await openMapFromTopBar();
      await waitForState('the map to open again', (state) => state.transient?.active[0] === `${FOLDER}/c.md`);
      await clickTransientItem(`${FOLDER}/sub`);
      await waitForState('the subfolder to be entered', (state) => state.activePath === `${FOLDER}/sub/inner.md`);

      await openMapFromTopBar();
      await waitForState('the map of the subfolder', (state) => state.transient?.items.join(',') === 'inner');
      await click('.sibling-notes-folder-map-pin', false);
      const pinned = await waitForState('the map to be pinned', (state) => state.pinned !== null && state.container === '');
      expect(pinned.pinned?.breadcrumbs.slice(1)).toStrictEqual(['/', FOLDER, '/', 'sub']);
      expect(pinned.pinned?.active).toStrictEqual([`${FOLDER}/sub/inner.md`]);

      await evalInObsidian({
        async callback({ app, folder }): Promise<void> {
          const file = app.vault.getFileByPath(`${folder}/a.md`);
          if (!file) {
            throw new Error('No a.md.');
          }
          await app.workspace.getLeaf(false).openFile(file);
        },
        input: { folder: FOLDER },
        vaultPath
      });
      await waitForState('the pinned map to follow the note', (state) => state.pinned?.active[0] === `${FOLDER}/a.md`);
    } finally {
      await evalInObsidian({
        async callback({ app, folder, viewType }): Promise<void> {
          app.workspace.detachLeavesOfType(viewType);
          const folderFile = app.vault.getFolderByPath(folder);
          if (folderFile) {
            await app.fileManager.trashFile(folderFile);
          }
        },
        input: { folder: FOLDER, viewType: FOLDER_MAP_VIEW_TYPE },
        vaultPath
      });
    }
  });
});

/**
 * Reads the open folder maps: the popover or sheet, and the pinned one.
 *
 * @param params - The app and the obsidian module.
 * @returns The state.
 */
function readState({ app, obsidianModule }: CommonArguments): MapState {
  function snapshot(mapEl: Element | null | undefined): MapSnapshot | null {
    if (!mapEl) {
      return null;
    }
    const targets: Record<string, string[]> = {};
    for (const el of mapEl.querySelectorAll<HTMLElement>('[data-path]')) {
      const actions = Array.from(el.querySelectorAll<HTMLElement>('.sibling-notes-folder-map-target'), (targetEl) => targetEl.dataset['action'] ?? '');
      if (actions.length > 0) {
        targets[el.dataset['path'] ?? ''] = actions;
      }
    }
    return {
      active: Array.from(mapEl.querySelectorAll<HTMLElement>('.sibling-notes-folder-map-item.is-active'), (el) => el.dataset['path'] ?? ''),
      breadcrumbs: Array.from(mapEl.querySelectorAll(':scope .sibling-notes-folder-map-breadcrumbs > *'), (el) => el.firstChild?.textContent ?? ''),
      items: Array.from(mapEl.querySelectorAll(':scope .sibling-notes-folder-map-item-name'), (el) => el.textContent),
      targets
    };
  }

  const popoverEl = activeDocument.body.querySelector('.sibling-notes-folder-map-popover');
  const sheetEl = activeDocument.body.querySelector('.sibling-notes-folder-map-sheet');
  const transientEl = popoverEl ?? sheetEl;
  const pinnedView = app.workspace.getLeavesOfType('sibling-notes-folder-map')[0]?.view;
  return {
    activePath: app.workspace.getActiveFile()?.path ?? '',
    container: popoverEl ? 'popover' : (sheetEl ? 'sheet' : ''),
    hasMapButton: Boolean(
      app.workspace.getMostRecentLeaf()?.view.containerEl
        .querySelector(':scope .sibling-notes-navigator-bar[data-placement="top"] button[data-action="map"]')
    ),
    isMobile: obsidianModule.Platform.isMobile,
    pinned: snapshot(pinnedView?.containerEl.querySelector('.sibling-notes-folder-map')),
    transient: snapshot(transientEl?.querySelector('.sibling-notes-folder-map'))
  };
}
