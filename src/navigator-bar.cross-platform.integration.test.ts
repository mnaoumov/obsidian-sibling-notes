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

// Isolation: `npx vitest run --project integration-tests:desktop src/navigator-bar.cross-platform.integration.test.ts`,
// Or `--project integration-tests:android`.
//
// Each step is its own short closure, and every wait runs in Node through `pollInObsidian`, because a cold
// Android emulator can take seconds to render a note in Reading view.

interface BarSnapshot {
  readonly disabled: string[];
  readonly position: string;
}

interface BarState {
  readonly activePath: string;
  readonly bottom: BarSnapshot | null;
  readonly bottomBarGap: number;
  readonly editorContentPadding: string;
  readonly editorOrder: string[];
  readonly mode: string;
  readonly readingFooterOrder: string[];
  readonly readingHeaderOrder: string[];
  readonly top: BarSnapshot | null;
}

const FOLDER = 'sn-bar';
const POLL_TIMEOUT_IN_MILLISECONDS = 20_000;

describe('navigator bar', () => {
  it('sits above and below the note in the editor and in Reading view, shows the position, and steps through the folder', async () => {
    const vaultPath = getTemporaryVault().path;

    async function waitForState(step: string, isReady: (state: BarState) => boolean): Promise<BarState> {
      return pollInObsidian({
        input: { folder: FOLDER },
        poll: readState,
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: step,
        until: isReady,
        vaultPath
      });
    }

    async function clickBarButton(placement: string, action: string): Promise<void> {
      await evalInObsidian({
        async callback({ action: actionName, app, lib: { clickElement }, placement: placementName }): Promise<void> {
          const selector = `.sibling-notes-navigator-bar[data-placement="${CSS.escape(placementName)}"] button[data-action="${CSS.escape(actionName)}"]`;
          const button = app.workspace.getMostRecentLeaf()?.view.containerEl.querySelector(selector);
          if (!(button instanceof HTMLElement)) {
            throw new TypeError(`No ${actionName} button on the ${placementName} bar.`);
          }
          await clickElement({ element: button });
        },
        input: { action, placement },
        vaultPath
      });
    }

    async function clickTopBarToggle(): Promise<void> {
      await evalInObsidian({
        async callback({ app, lib: { clickElement, waitUntil } }): Promise<void> {
          const SETTING_NAME = 'Show the top bar';
          app.setting.open();
          app.setting.openTabById('sibling-notes');
          function findToggle(): HTMLElement | null {
            const item = [...app.setting.containerEl.querySelectorAll('.setting-item')]
              .find((el) => el.querySelector('.setting-item-name')?.textContent === SETTING_NAME);
            return item?.querySelector<HTMLElement>('.checkbox-container') ?? null;
          }
          await waitUntil({ predicate: () => findToggle() !== null, timeoutInMilliseconds: 5000 });
          const toggle = findToggle();
          if (!toggle) {
            throw new Error(`No ${SETTING_NAME} toggle.`);
          }
          const wasEnabled = toggle.hasClass('is-enabled');
          await clickElement({ element: toggle });
          await waitUntil({ predicate: () => toggle.hasClass('is-enabled') !== wasEnabled, timeoutInMilliseconds: 5000 });
          app.setting.close();
        },
        vaultPath
      });
    }

    await evalInObsidian({
      async callback({ app, folder }): Promise<void> {
        await app.vault.createFolder(folder);
        await app.vault.create(`${folder}/a.md`, '---\ntag: demo\n---\nAlpha\n');
        await app.vault.create(`${folder}/b.md`, 'Beta\n');
        await app.vault.create(`${folder}/c.md`, 'Gamma\n');
        const file = app.vault.getFileByPath(`${folder}/a.md`);
        if (!file) {
          throw new Error('No a.md.');
        }
        await app.workspace.getLeaf(false).openFile(file, { state: { mode: 'source' } });
      },
      input: { folder: FOLDER },
      vaultPath
    });

    let isTopBarHidden = false;
    try {
      const atFirst = await waitForState('the bars in the editor', (state) => state.top?.position === '1 / 3' && state.bottom !== null);
      expect(atFirst.editorOrder).toStrictEqual(['inline-title', 'metadata-container', 'bar:top', 'cm-contentContainer', 'bar:bottom', 'embedded-backlinks']);
      // The scroll-past-end space moved from below the last line to below the bottom bar.
      expect(atFirst.editorContentPadding).toBe('0px');
      expect(atFirst.bottomBarGap).toBeLessThan(50);
      expect(atFirst.top).toStrictEqual({ disabled: ['home', 'pageUp', 'previous'], position: '1 / 3' });

      await clickBarButton('top', 'next');
      await waitForState('Next from the top bar', (state) => state.activePath === `${FOLDER}/b.md` && state.top?.position === '2 / 3');

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
      const reading = await waitForState('the bars in Reading view', (state) => state.mode === 'preview' && state.readingHeaderOrder.includes('bar:top') && state.readingFooterOrder.includes('bar:bottom'));
      expect(reading.readingHeaderOrder).toStrictEqual(['inline-title', 'metadata-container', 'bar:top']);
      expect(reading.readingFooterOrder).toStrictEqual(['bar:bottom', 'embedded-backlinks']);

      await clickBarButton('bottom', 'next');
      const atLast = await waitForState('Next from the bottom bar', (state) => state.activePath === `${FOLDER}/c.md` && state.bottom?.position === '3 / 3');
      expect(atLast.bottom).toStrictEqual({ disabled: ['next', 'pageDown', 'end'], position: '3 / 3' });

      await setSortOrder('alphabeticalReverse');
      await waitForState('the position after a reverse sort', (state) => state.top?.position === '1 / 3');
      await setSortOrder('alphabetical');

      await clickTopBarToggle();
      isTopBarHidden = true;
      const hidden = await waitForState('the top bar to hide', (state) => state.top === null);
      expect(hidden.bottom?.position).toBe('3 / 3');
    } finally {
      if (isTopBarHidden) {
        await clickTopBarToggle();
      }
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

    async function setSortOrder(sortOrder: string): Promise<void> {
      await evalInObsidian({
        async callback({ app, sortOrder: order }): Promise<void> {
          const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
          await leaf?.loadIfDeferred();
          (leaf?.view as FileExplorerView | undefined)?.setSortOrder(order);
        },
        input: { sortOrder },
        vaultPath
      });
    }
  });
});

/**
 * Reads where the bars of the most recent note are and what they show. A bar reads as `bar:top` /
 * `bar:bottom` in an order, anything else as its first class.
 *
 * @param params - The app and the obsidian module.
 * @returns The state.
 */
function readState({ app, obsidianModule }: CommonArguments): BarState {
  const BAR_SELECTOR = '.sibling-notes-navigator-bar';
  const view = app.workspace.getMostRecentLeaf()?.view;
  if (!(view instanceof obsidianModule.MarkdownView)) {
    throw new TypeError('The most recent leaf shows no Markdown view.');
  }

  function getChildOrder(el: Element | null): string[] {
    return el
      ? Array.from(el.children, (child) => child.instanceOf(HTMLElement) && child.matches(BAR_SELECTOR) ? `bar:${child.dataset['placement'] ?? ''}` : child.classList[0] ?? child.tagName)
      : [];
  }

  function getBar(placement: string): HTMLElement | null {
    const bar = view?.containerEl.querySelector<HTMLElement>(`${BAR_SELECTOR}[data-placement="${CSS.escape(placement)}"]`) ?? null;
    return bar?.isShown() ? bar : null;
  }

  function snapshot(bar: HTMLElement | null): BarSnapshot | null {
    return bar
      ? {
        disabled: Array.from(bar.querySelectorAll('button'), (button) => button.disabled ? button.dataset['action'] ?? '' : '').filter(Boolean),
        position: bar.querySelector(':scope .sibling-notes-navigator-bar-position')?.textContent ?? ''
      }
      : null;
  }

  const contentEl = view.editMode.cm.contentDOM;
  const bottomBar = getBar('bottom');
  return {
    activePath: app.workspace.getActiveFile()?.path ?? '',
    bottom: snapshot(bottomBar),
    bottomBarGap: bottomBar ? bottomBar.getBoundingClientRect().top - contentEl.getBoundingClientRect().bottom : NaN,
    editorContentPadding: contentEl.style.paddingBottom,
    editorOrder: getChildOrder(view.editMode.sizerEl),
    mode: view.getMode(),
    readingFooterOrder: getChildOrder(view.containerEl.querySelector(':scope .markdown-reading-view .mod-footer')),
    readingHeaderOrder: getChildOrder(view.containerEl.querySelector(':scope .markdown-reading-view .mod-header')),
    top: snapshot(getBar('top'))
  };
}
