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

// Isolation: `npx vitest run --project integration-tests:desktop src/virtual-folder-note-view.cross-platform.integration.test.ts`,
// Or `--project integration-tests:android`.
//
// Each step is its own short closure, and every wait runs in Node through `pollInObsidian`, because a cold
// Android emulator can take seconds to render a view.

interface ReadStateParams extends CommonArguments {
  readonly viewType: string;
}

interface ViewState {
  readonly activePath: string;
  readonly bottomPosition: string;
  readonly empty: string;
  readonly folderNoteBody: string;
  readonly folderNoteTitle: string;
  readonly folderPath: string;
  readonly isEnterDisabled: boolean;
  readonly items: string[];
  readonly title: string;
  readonly topPosition: string;
}

const FOLDER = 'sn-view';
const POLL_TIMEOUT_IN_MILLISECONDS = 20_000;
const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';

describe('virtual folder note', () => {
  it('lists the folder in explorer order, shows its folder note, opens a clicked item, and enters the folder', async () => {
    const vaultPath = getTemporaryVault().path;

    async function waitForState(step: string, isReady: (state: ViewState) => boolean): Promise<ViewState> {
      return pollInObsidian({
        input: { viewType: VIRTUAL_FOLDER_NOTE_VIEW_TYPE },
        poll: readState,
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: step,
        until: isReady,
        vaultPath
      });
    }

    async function click(selector: string): Promise<void> {
      await evalInObsidian({
        async callback({ app, lib: { clickElement }, selector: elementSelector }): Promise<void> {
          const el = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(elementSelector);
          if (!(el instanceof HTMLElement)) {
            throw new TypeError(`No ${elementSelector}.`);
          }
          await clickElement({ element: el });
        },
        input: { selector },
        vaultPath
      });
    }

    async function openFolder(folderPath: string): Promise<void> {
      await evalInObsidian({
        async callback({ app, folderPath: path, viewType }): Promise<void> {
          await app.workspace.getLeaf(false).setViewState({ active: true, state: { folderPath: path }, type: viewType });
        },
        input: { folderPath, viewType: VIRTUAL_FOLDER_NOTE_VIEW_TYPE },
        vaultPath
      });
    }

    await evalInObsidian({
      async callback({ app, folder }): Promise<void> {
        await app.vault.createFolder(folder);
        await app.vault.createFolder(`${folder}/sub`);
        await app.vault.createFolder(`${folder}/sub/inner`);
        await app.vault.create(`${folder}/sub/b.md`, 'Beta\n');
        await app.vault.create(`${folder}/sub/a.md`, 'Alpha\n');
        await app.vault.create(`${folder}/sub/sub.md`, '---\ntag: hidden-from-body\n---\nThe folder note **body**.\n');
        await app.vault.create(`${folder}/z.md`, 'Zulu\n');
      },
      input: { folder: FOLDER },
      vaultPath
    });

    try {
      await openFolder(`${FOLDER}/sub`);
      const shown = await waitForState('the virtual folder note', (state) => state.folderPath === `${FOLDER}/sub` && state.folderNoteBody !== '');
      expect(shown.title).toBe('sub');
      expect(shown.items).toStrictEqual([`${FOLDER}/sub/inner`, `${FOLDER}/sub/a.md`, `${FOLDER}/sub/b.md`, `${FOLDER}/sub/sub.md`]);
      expect(shown.folderNoteTitle).toBe('sub');
      expect(shown.folderNoteBody).toBe('The folder note body.');
      expect(shown.topPosition).toBe('1 / 2');
      expect(shown.bottomPosition).toBe('1 / 2');
      expect(shown.isEnterDisabled).toBe(false);

      await evalInObsidian({
        async callback({ app, folder }): Promise<void> {
          const file = app.vault.getFileByPath(`${folder}/sub/sub.md`);
          if (!file) {
            throw new Error('No sub.md.');
          }
          await app.vault.process(file, (content) => content.replace('**body**', '**new body**'));
        },
        input: { folder: FOLDER },
        vaultPath
      });
      await waitForState('the folder note to re-render', (state) => state.folderNoteBody === 'The folder note new body.');

      await click(`.sibling-notes-virtual-folder-note-item[data-path="${FOLDER}/sub/a.md"]`);
      await waitForState('the clicked note', (state) => state.folderPath === '' && state.activePath === `${FOLDER}/sub/a.md`);

      await openFolder(`${FOLDER}/sub`);
      await waitForState('the virtual folder note again', (state) => state.folderPath === `${FOLDER}/sub`);
      await click('.sibling-notes-virtual-folder-note-enter');
      const inner = await waitForState('the first item, an empty subfolder', (state) => state.folderPath === `${FOLDER}/sub/inner`);
      expect(inner.items).toStrictEqual([]);
      expect(inner.empty).toBe('This folder is empty.');
      expect(inner.isEnterDisabled).toBe(true);
      expect(inner.folderNoteBody).toBe('');
      expect(inner.topPosition).toBe('1 / 4');
    } finally {
      await evalInObsidian({
        async callback({ app, folder }): Promise<void> {
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

/**
 * Reads what the most recent leaf shows: a virtual folder note's content, or the active file.
 *
 * @param params - The app and the view type.
 * @returns The state.
 */
function readState({ app, viewType }: ReadStateParams): ViewState {
  const view = app.workspace.getMostRecentLeaf()?.view;
  const isFolderView = view?.getViewType() === viewType;
  const el = isFolderView ? view.containerEl : null;

  function getText(selector: string): string {
    return el?.querySelector(selector)?.textContent.trim() ?? '';
  }

  const folderPath = isFolderView ? view.getState()['folderPath'] : '';
  return {
    activePath: app.workspace.getActiveFile()?.path ?? '',
    bottomPosition: getText('.sibling-notes-navigator-bar[data-placement="bottom"] .sibling-notes-navigator-bar-position'),
    empty: getText('.sibling-notes-virtual-folder-note-empty'),
    folderNoteBody: getText('.sibling-notes-virtual-folder-note-folder-note-body'),
    folderNoteTitle: getText('.sibling-notes-virtual-folder-note-folder-note-title'),
    folderPath: typeof folderPath === 'string' ? folderPath : '',
    isEnterDisabled: el?.querySelector<HTMLButtonElement>('.sibling-notes-virtual-folder-note-enter')?.disabled ?? false,
    items: el ? Array.from(el.querySelectorAll<HTMLElement>('.sibling-notes-virtual-folder-note-item'), (itemEl) => itemEl.dataset['path'] ?? '') : [],
    title: getText('.sibling-notes-virtual-folder-note-title'),
    topPosition: getText('.sibling-notes-navigator-bar[data-placement="top"] .sibling-notes-navigator-bar-position')
  };
}
