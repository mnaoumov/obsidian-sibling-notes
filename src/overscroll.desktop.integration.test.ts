import type { CommonArguments } from 'obsidian-integration-testing';

import { sleep as sleepInNode } from '@mnaoumov/typescript-lib/async';
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

// Desktop-only: it drives the pull with wheel events, which a phone does not send. The touch pull shares the
// Gesture and the navigation, and its own rules are unit-tested.
// Isolation: `npx vitest run --project integration-tests:desktop src/overscroll.desktop.integration.test.ts`.
//
// Each step is its own short closure, and every wait runs in Node through `pollInObsidian`.

interface ScrollState {
  readonly activePath: string;
  readonly isAtEnd: boolean;
  readonly mode: string;
}

const FOLDER = 'sn-overscroll';
const POLL_TIMEOUT_IN_MILLISECONDS = 10_000;
const NOTCH = 100;

/**
 * A pause longer than the gap that starts a new gesture.
 */
const NEW_GESTURE_PAUSE_IN_MILLISECONDS = 400;

/**
 * How long the editor takes to measure a long note and restore what it restores on open.
 */
const SETTLE_DELAY_IN_MILLISECONDS = 1000;

/**
 * How many reads in a row must find the note at its end before it counts as staying there.
 */
const SETTLED_READ_COUNT = 5;

describe('scrolling past the edge', () => {
  it('pulls through the notes of a folder in the editor and in Reading view, and lands at the end of the previous one', async () => {
    const vaultPath = getTemporaryVault().path;

    async function waitForState(step: string, isReady: (state: ScrollState) => boolean): Promise<ScrollState> {
      return pollInObsidian({
        poll: readState,
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: step,
        until: isReady,
        vaultPath
      });
    }

    async function setOverscrollEdges(edges: string): Promise<void> {
      await evalInObsidian({
        async callback({ app, edges: value, lib: { waitUntil } }): Promise<void> {
          const SETTING_NAME = 'Open by scrolling past the edge';
          app.setting.open();
          app.setting.openTabById('sibling-notes');
          function findSelect(): HTMLSelectElement | null {
            const item = [...app.setting.containerEl.querySelectorAll('.setting-item')]
              .find((el) => el.querySelector('.setting-item-name')?.textContent === SETTING_NAME);
            return item?.querySelector('select') ?? null;
          }
          await waitUntil({ predicate: () => findSelect() !== null, timeoutInMilliseconds: 5000 });
          const select = findSelect();
          if (!select) {
            throw new Error(`No ${SETTING_NAME} dropdown.`);
          }
          select.value = value;
          select.dispatchEvent(new Event('change'));
          app.setting.close();
        },
        input: { edges },
        vaultPath
      });
    }

    /**
     * Starts a new gesture after a pause, and keeps scrolling until the pull opens another note.
     *
     * @param deltaY - The scroll of each wheel event.
     * @returns The strip's label after the first wheel event.
     */
    async function pull(deltaY: number): Promise<string> {
      return evalInObsidian({
        async callback({ app, deltaY: delta, obsidianModule, pause }): Promise<string> {
          const NOTCH_INTERVAL_IN_MILLISECONDS = 16;
          const MAX_NOTCHES = 40;
          const view = app.workspace.getMostRecentLeaf()?.view;
          if (!(view instanceof obsidianModule.MarkdownView)) {
            throw new TypeError('The most recent leaf shows no Markdown view.');
          }
          const scrollerEl = view.getMode() === 'preview' ? view.previewMode.renderer.previewEl : view.editMode.cm.scrollDOM;
          const startPath = app.workspace.getActiveFile()?.path;
          function dispatchWheel(): void {
            // eslint-disable-next-line obsidian-dev-toolkit/no-untrusted-input-events -- The plugin reads wheel events whatever their trust, and there is no trusted equivalent to send.
            scrollerEl.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: delta }));
          }

          await sleep(pause);
          dispatchWheel();
          const label = view.containerEl.querySelector('.sibling-notes-overscroll-indicator-label')?.textContent ?? '';
          for (let notch = 0; notch < MAX_NOTCHES && app.workspace.getActiveFile()?.path === startPath; notch++) {
            await sleep(NOTCH_INTERVAL_IN_MILLISECONDS);
            if (app.workspace.getActiveFile()?.path === startPath) {
              dispatchWheel();
            }
          }
          return label;
        },
        input: { deltaY, pause: NEW_GESTURE_PAUSE_IN_MILLISECONDS },
        vaultPath
      });
    }

    await evalInObsidian({
      async callback({ app, folder }): Promise<void> {
        const LONG_NOTE_LINE_COUNT = 200;
        await app.vault.createFolder(folder);
        await app.vault.create(`${folder}/a.md`, Array.from({ length: LONG_NOTE_LINE_COUNT }, (_, index) => `Line ${String(index + 1)}`).join('\n\n'));
        await app.vault.create(`${folder}/b.md`, 'b');
        await app.vault.create(`${folder}/c.md`, 'c');
        const file = app.vault.getFileByPath(`${folder}/a.md`);
        if (!file) {
          throw new Error('No a.md.');
        }
        await app.workspace.getLeaf(false).openFile(file);
      },
      input: { folder: FOLDER },
      vaultPath
    });

    try {
      await setOverscrollEdges('both');

      // Live Preview, from the end of a long note to the next one. The editor measures the note as it renders,
      // So the end is set again until it stays.
      let settledReads = 0;
      await pollInObsidian({
        poll: checkAtEndThenScrollToEnd,
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: 'a.md to stay at its end',
        until: (isAtEnd) => {
          settledReads = isAtEnd ? settledReads + 1 : 0;
          return settledReads >= SETTLED_READ_COUNT;
        },
        vaultPath
      });
      expect(await pull(NOTCH)).toBe('Keep scrolling for next: b');
      await waitForState('the pull to open b.md', (state) => state.activePath === `${FOLDER}/b.md`);

      // Back again, landing at the end of the long note.
      expect(await pull(-NOTCH)).toBe('Keep scrolling for previous: a');
      await waitForState('the pull to open a.md', (state) => state.activePath === `${FOLDER}/a.md`);
      await sleepInNode({ milliseconds: SETTLE_DELAY_IN_MILLISECONDS });
      const landed = await evalInObsidian({ callback: readState, vaultPath });
      expect(landed.isAtEnd).toBe(true);

      // Reading view, on to the last note, where there is nothing further.
      expect(await pull(NOTCH)).toBe('Keep scrolling for next: b');
      await waitForState('the pull to open b.md again', (state) => state.activePath === `${FOLDER}/b.md`);
      await evalInObsidian({
        async callback({ app }): Promise<void> {
          const view = app.workspace.getMostRecentLeaf()?.view;
          if (!view) {
            throw new Error('No view.');
          }
          await view.setState({ ...view.getState(), mode: 'preview' }, { history: false });
        },
        vaultPath
      });
      await waitForState('Reading view', (state) => state.mode === 'preview');
      expect(await pull(NOTCH)).toBe('Keep scrolling for next: c');
      const atLast = await waitForState('the pull to open c.md', (state) => state.activePath === `${FOLDER}/c.md`);
      expect(atLast.mode).toBe('preview');
      expect(await pull(NOTCH)).toBe('This is the last item in the folder');
    } finally {
      await setOverscrollEdges('none');
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
 * Scrolls the most recent note's editor to its end.
 *
 * @param params - The app and the obsidian module.
 * @returns Whether it was already at its end before this scroll.
 */
function checkAtEndThenScrollToEnd({ app, obsidianModule }: CommonArguments): boolean {
  const view = app.workspace.getMostRecentLeaf()?.view;
  if (!(view instanceof obsidianModule.MarkdownView)) {
    throw new TypeError('The most recent leaf shows no Markdown view.');
  }
  const scrollerEl = view.editMode.cm.scrollDOM;
  const isAtEnd = scrollerEl.scrollTop + scrollerEl.clientHeight >= scrollerEl.scrollHeight - 1;
  scrollerEl.scrollTop = scrollerEl.scrollHeight;
  return isAtEnd;
}

/**
 * Reads where the most recent note stands.
 *
 * @param params - The app and the obsidian module.
 * @returns The state.
 */
function readState({ app, obsidianModule }: CommonArguments): ScrollState {
  const view = app.workspace.getMostRecentLeaf()?.view;
  if (!(view instanceof obsidianModule.MarkdownView)) {
    throw new TypeError('The most recent leaf shows no Markdown view.');
  }
  const scrollerEl = view.getMode() === 'preview' ? view.previewMode.renderer.previewEl : view.editMode.cm.scrollDOM;
  return {
    activePath: app.workspace.getActiveFile()?.path ?? '',
    isAtEnd: scrollerEl.scrollTop + scrollerEl.clientHeight >= scrollerEl.scrollHeight - 1,
    mode: view.getMode()
  };
}
