/**
 * @file
 *
 * Produces the mobile screenshots the community-directory listing needs, driving a real Obsidian Mobile on an
 * Android emulator and writing `images/screenshots/screenshot-mobile-N.png`.
 *
 * The mobile half of `screenshots.desktop-capture.integration.test.ts`, staged by the same closures. A phone has no
 * hover and no side panel beside the note, so the map is the bottom sheet with each button's icon on its target,
 * and the pinned map's frame is replaced by the bottom bar at the end of the note.
 *
 * There is no mobile equivalent of the desktop viewport override, so the capture is always the device's own
 * framebuffer, and the AVD is built at exactly the 900x1600 the directory asks for: see `SCREENSHOT_AVD_NAME` in
 * `scripts/vitest-config.ts`.
 *
 * Excluded from `npm run test:integration` by its file name: see the `capture-screenshots:android` project in
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

const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * A cold-booted AVD renders its first view far more slowly than a warm desktop does.
 */
const RENDER_TIMEOUT_IN_MILLISECONDS = 120_000;

const TEST_TIMEOUT_IN_MILLISECONDS = 600_000;

const POLL_INTERVAL_IN_MILLISECONDS = 500;

/**
 * Time for the sheet to finish rising, or a view to finish laying out, after its content is ready.
 */
const SETTLE_DELAY_IN_MILLISECONDS = 1500;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  await evalInObsidian({
    callback({ app }): void {
      app.changeTheme('obsidian');
      // Each note opens with its own `# H1`, so the inline title would print every name twice.
      app.vault.setConfig('showInlineTitle', false);
      // On a phone the drawers cover the note, and no frame is about them.
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    },
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

  await sleepInNode(SETTLE_DELAY_IN_MILLISECONDS);
}, TEST_TIMEOUT_IN_MILLISECONDS);
describe('mobile store screenshots', () => {
  it('1 - the navigator bar', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('top-bar', '3 / 4')).toBe('3 / 4');
    await shoot(1, 'Step through the folder in File explorer order');
  });

  it('2 - the folder map sheet', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('map', 'Chapter 2 -> ')).toBe('Chapter 2 -> ');
    await shoot(2, 'The folder map shows where each button goes');
  });

  it('3 - the bottom bar', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('bottom-bar', '3 / 4')).toBe('3 / 4');
    await shoot(3, 'A second bar waits at the end of the note');
  });

  it('4 - the virtual folder note', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('virtual-folder-note', 'Appendix')).toBe('Appendix');
    await shoot(4, 'A subfolder opens as a view of what it holds');
  });

  it('5 - the settings tab', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    expect(await stage('settings', 'settings')).toBe('settings');
    await shoot(5, 'Choose the bars, the page size and the folder notes');
  });
});

/**
 * Captures the device framebuffer, captions it, and writes it as `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * The AVD is 900x1600, so the device frame IS the directory's size. Asserting it here keeps that true: run this
 * against any other AVD and it fails loudly instead of quietly shipping an off-spec image.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  expect(readPngDimensions(bytes)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  // Captioned after capture, so the frame stays an untouched device screenshot and rewording a label needs no re-shoot.
  const labeled = await labelScreenshot(bytes, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
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
