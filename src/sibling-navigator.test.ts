import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App as AppOriginal,
  TAbstractFile,
  TFile as TFileOriginal,
  WorkspaceLeaf
} from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { NavigationAction } from './navigation-action.ts';
import { SiblingNavigator } from './sibling-navigator.ts';

interface Fixture {
  readonly app: AppOriginal;
  readonly navigator: SiblingNavigator;
  readonly openFile: ReturnType<typeof vi.fn>;
  readonly revealInFolder: ReturnType<typeof vi.fn>;
  setActiveFile: (path: null | string) => void;
  readonly showNotice: ReturnType<typeof vi.fn>;
}

const PAGE_SIZE = 2;

describe('SiblingNavigator', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture(true);
  });

  function getTargetPath(action: NavigationAction): null | string {
    return fixture.navigator.getTarget(action)?.path ?? null;
  }

  it('has no current item and no target without an active file', () => {
    fixture.setActiveFile(null);
    expect(fixture.navigator.getCurrentItem()).toBeNull();
    expect(getTargetPath(NavigationAction.Next)).toBeNull();
    expect(getTargetPath(NavigationAction.Up)).toBeNull();
  });

  it('answers every in-folder action from the sequence of the active file\'s folder', () => {
    fixture.setActiveFile('d/b.md');
    expect(getTargetPath(NavigationAction.Previous)).toBe('d/a.md');
    expect(getTargetPath(NavigationAction.Next)).toBe('d/c.md');
    expect(getTargetPath(NavigationAction.Home)).toBe('d/sub');
    expect(getTargetPath(NavigationAction.End)).toBe('d/e.md');
    expect(getTargetPath(NavigationAction.PageUp)).toBe('d/sub');
    expect(getTargetPath(NavigationAction.PageDown)).toBe('d/e.md');
  });

  it('goes up to the folder just left, and not above a root-level item', () => {
    fixture.setActiveFile('d/sub/x.md');
    expect(getTargetPath(NavigationAction.Up)).toBe('d/sub');
    fixture.setActiveFile('top.md');
    expect(getTargetPath(NavigationAction.Up)).toBeNull();
  });

  it('opens a file it lands on', async () => {
    fixture.setActiveFile('d/b.md');
    await fixture.navigator.navigate(NavigationAction.Next);
    expect(castTo<TAbstractFile>(fixture.openFile.mock.calls[0]?.[0]).path).toBe('d/c.md');
  });

  it('does nothing for an unavailable action', async () => {
    fixture.setActiveFile('d/e.md');
    await fixture.navigator.navigate(NavigationAction.Next);
    expect(fixture.openFile).not.toHaveBeenCalled();
    expect(fixture.revealInFolder).not.toHaveBeenCalled();
  });

  it('lands on a subfolder by revealing it, and the next move continues from there', async () => {
    fixture.setActiveFile('d/a.md');
    await fixture.navigator.navigate(NavigationAction.Previous);
    expect(castTo<TAbstractFile>(fixture.revealInFolder.mock.calls[0]?.[0]).path).toBe('d/sub');
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/sub');
    expect(getTargetPath(NavigationAction.Next)).toBe('d/a.md');
    expect(getTargetPath(NavigationAction.Previous)).toBeNull();

    await fixture.navigator.navigate(NavigationAction.Next);
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/a.md');
  });

  it('forgets the landed subfolder once another file becomes active, or the subfolder is gone', async () => {
    fixture.setActiveFile('d/sub/x.md');
    await fixture.navigator.navigate(NavigationAction.Up);
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/sub');
    fixture.setActiveFile('d/c.md');
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/c.md');

    fixture.setActiveFile('d/sub/x.md');
    await fixture.navigator.navigate(NavigationAction.Up);
    vi.spyOn(fixture.app.vault, 'getAbstractFileByPath').mockReturnValue(null);
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/sub/x.md');
  });

  it('tells the user where it went when the File explorer is disabled', async () => {
    fixture = createFixture(false);
    fixture.setActiveFile('d/sub/x.md');
    await fixture.navigator.navigate(NavigationAction.Up);
    expect(fixture.showNotice).toHaveBeenCalledWith('Moved to the folder d/sub. Enable the File explorer to see it.');
    expect(fixture.navigator.getCurrentItem()?.path).toBe('d/sub');
  });
});

function createFixture(isFileExplorerEnabled: boolean): Fixture {
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('d');
  mockApp.vault.createFolderSync__('d/sub');
  mockApp.vault.createSync__('d/sub/x.md', '');
  for (const name of ['a', 'b', 'c', 'e']) {
    mockApp.vault.createSync__(`d/${name}.md`, '');
  }
  mockApp.vault.createSync__('top.md', '');
  const app = mockApp.asOriginalType__();

  let activeFile: null | TFileOriginal = null;
  vi.spyOn(app.workspace, 'getActiveFile').mockImplementation(() => activeFile);
  vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
  const openFile = vi.fn(() => noopAsync());
  vi.spyOn(app.workspace, 'getLeaf').mockReturnValue(castTo<WorkspaceLeaf>({ openFile }));
  const revealInFolder = vi.fn();
  // The test mocks leave the internal plugins to the test, which needs only the File explorer's lookup.
  app.internalPlugins = strictProxy<AppOriginal['internalPlugins']>({
    getEnabledPluginById: castTo<AppOriginal['internalPlugins']['getEnabledPluginById']>(vi.fn(() => isFileExplorerEnabled ? { revealInFolder } : null))
  });
  const showNotice = vi.fn();

  return {
    app,
    navigator: new SiblingNavigator({
      app,
      getPageSize: () => PAGE_SIZE,
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice })
    }),
    openFile,
    revealInFolder,
    setActiveFile(path: null | string): void {
      activeFile = path === null ? null : app.vault.getFileByPath(path);
    },
    showNotice
  };
}
