/**
 * @file
 *
 * Produces the desktop screenshots the community-directory listing needs, driving a real Obsidian on a copy of the
 * demo vault and writing `images/screenshots/screenshot-desktop-N.png`.
 *
 * Five frames, one per headline feature a reader can see, all on the walkthrough folder `Materials/01 Folder
 * navigation`: the top bar on `Chapter 2`, the folder map popover with a hovered button's target, the virtual folder
 * note of `Appendix` with its folder note, the pinned map beside the bottom bar, and the settings tab. Five is the
 * directory's cap per form factor. The frames are staged by the closures in
 * `src/test-helpers/screenshot-stages.test.helper.ts`, which the Android suite shares.
 *
 * Excluded from `npm run test:integration` by its file name: see the `capture-screenshots:desktop` project in
 * `scripts/vitest-config.ts`. Capturing is an explicit operation (`npm run capture:screenshots`).
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as sleepInNode } from 'node:timers/promises';
import {
  applyObsidianTheme,
  captureObsidianScreenshot,
  computeLabelBand,
  evalInObsidian,
  labelScreenshot,
  pollInObsidian,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { ScreenshotStage } from './test-helpers/screenshot-stages.test.helper.ts';

import {
  areAllLinksResolved,
  pollStage,
  reserveCaptionBand,
  startStage
} from './test-helpers/screenshot-stages.test.helper.ts';

const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;

const TEST_TIMEOUT_IN_MILLISECONDS = 120_000;
const RENDER_TIMEOUT_IN_MILLISECONDS = 60_000;
const POLL_INTERVAL_IN_MILLISECONDS = 250;

/**
 * Time for the explorer and the note to finish laying out after their content is ready.
 */
const SETTLE_DELAY_IN_MILLISECONDS = 1000;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

/**
 * The part of Electron's `BrowserWindow` the capture sizes the window with.
 */
interface ElectronBrowserWindow {
  readonly setContentSize: (width: number, height: number) => void;
}

/**
 * Electron's remote module, which reaches the main-process window from the renderer.
 */
interface ElectronRemote {
  readonly getCurrentWindow: () => ElectronBrowserWindow;
}

/**
 * The desktop renderer's window, which can load Electron's remote module.
 */
interface ElectronWindow extends Window {
  readonly require: (id: '@electron/remote') => ElectronRemote;
}

/*
 * `applyObsidianTheme` rather than a bare `app.changeTheme('obsidian')`: that only schedules the config save, and a
 * config reload landing first drops the theme, so every frame would come out light.
 */
beforeAll(async () => {
  await applyObsidianTheme({ theme: 'dark', vaultPath: vaultPath() });
  await evalInObsidian({
    async callback({ app, heightInPixels, lib, widthInPixels }): Promise<void> {
      const { waitUntil } = lib;

      /*
       * The capture pins its viewport only for the length of the frame, so a window of any other size lays the
       * explorer out twice: once when it is staged and again when it is shot.
       */
      const RESIZE_SETTLE_DELAY_IN_MILLISECONDS = 500;
      const browserWindow = (activeWindow as ElectronWindow).require('@electron/remote').getCurrentWindow();

      // The window's viewport and its content size differ by a border, which the second call takes off.
      browserWindow.setContentSize(widthInPixels, heightInPixels);
      await sleep(RESIZE_SETTLE_DELAY_IN_MILLISECONDS);
      browserWindow.setContentSize(
        2 * widthInPixels - activeWindow.innerWidth,
        2 * heightInPixels - activeWindow.innerHeight
      );
      await waitUntil({
        message: 'the window to take the frame size',
        predicate: () => activeWindow.innerWidth === widthInPixels && activeWindow.innerHeight === heightInPixels
      });

      // Each note opens with its own `# H1`, so the inline title would print every name twice.
      app.vault.setConfig('showInlineTitle', false);
      // Only the pinned map's frame needs the right sidebar, and it opens it itself.
      app.workspace.rightSplit.collapse();
    },
    input: { heightInPixels: HEIGHT_IN_PIXELS, widthInPixels: WIDTH_IN_PIXELS },
    vaultPath: vaultPath()
  });
  await evalInObsidian({
    callback: reserveCaptionBand,
    input: { bandHeightInPixels: computeLabelBand({ imageHeightInPixels: HEIGHT_IN_PIXELS, imageWidthInPixels: WIDTH_IN_PIXELS }).heightInPixels },
    vaultPath: vaultPath()
  });
  await pollInObsidian({
    intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
    poll: areAllLinksResolved,
    timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'the metadata cache never resolved every note',
    until: (isResolved: boolean): boolean => isResolved,
    vaultPath: vaultPath()
  });
});

describe('desktop store screenshots', () => {
  it('1 - the navigator bar', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('top-bar', '3 / 4')).toBe('3 / 4');
    await shoot(1, 'Step through the folder in File explorer order');
  });

  it('2 - the folder map popover', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('map', 'Chapter 2 -> Chapter 3')).toBe('Chapter 2 -> Chapter 3');
    await shoot(2, 'The folder map shows where each button goes');
  });

  it('3 - the virtual folder note', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('virtual-folder-note', 'Appendix')).toBe('Appendix');
    await shoot(3, 'A subfolder opens as a view of what it holds');
  });

  it('4 - the pinned folder map', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('pinned-map', 'Chapter 2')).toBe('Chapter 2');
    await shoot(4, 'Pin the map to the side panel, and a bar below the note');
  });

  it('5 - the settings tab', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('settings', 'settings')).toBe('settings');
    await shoot(5, 'Choose the bars, the page size and the folder notes');
  });
});

/**
 * Captures the window, captions it, and writes it as `images/screenshots/screenshot-desktop-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  // Captioned after capture, so the frame stays an untouched window shot and rewording a label needs no re-shoot.
  const labeled = await labelScreenshot(bytes, { text: caption });

  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

/**
 * Stages a frame and waits in Node until it shows what it is about.
 *
 * @param screenshotStage - The frame to stage.
 * @param expected - What the frame shows once it is ready.
 * @returns What the frame shows.
 */
async function stage(screenshotStage: ScreenshotStage, expected: string): Promise<string> {
  const shown = await pollInObsidian({
    input: { stage: screenshotStage },
    intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
    poll: pollStage,
    start: startStage,
    timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: `the ${screenshotStage} frame never showed ${expected}`,
    until: (result: string): boolean => result === expected,
    vaultPath: vaultPath()
  });
  await sleepInNode(SETTLE_DELAY_IN_MILLISECONDS);
  return shown;
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
