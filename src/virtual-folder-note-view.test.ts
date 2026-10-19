import type {
  App as AppOriginal,
  Component,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf
} from 'obsidian';

import { fullRender } from '@mnaoumov/obsidian-lib/markdown';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { addIcon } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest';

import type { FolderMapComponent } from './folder-map-component.ts';
import type { VirtualFolderNoteViewSettings } from './virtual-folder-note-view.ts';

import { NavigationAction } from './navigation-action.ts';
import { SiblingNavigator } from './sibling-navigator.ts';
import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from './virtual-folder-note-view.ts';

vi.mock('@mnaoumov/obsidian-lib/markdown', () => ({
  fullRender: vi.fn(() => noopAsync())
}));

interface DeferredContent {
  readonly promise: Promise<string>;
  readonly resolve: (content: string) => void;
}

interface Fixture {
  readonly app: AppOriginal;
  readonly highlightTarget: ReturnType<typeof vi.fn>;
  readonly leaf: WorkspaceLeaf;
  readonly mockApp: App;
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly newTabLeaf: WorkspaceLeaf;
  readonly open: ReturnType<typeof vi.fn>;
  readonly settings: Settings;
  readonly show: ReturnType<typeof vi.fn>;
  readonly updateHeader: ReturnType<typeof vi.fn>;
  readonly view: VirtualFolderNoteView;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type Settings = Mutable<VirtualFolderNoteViewSettings>;

const FOLDER_NOTE_CONTENT = '---\ntitle: D\n---\nAbout d.';

function createDeferredContent(): DeferredContent {
  const resolvers: ((content: string) => void)[] = [];
  const promise = new Promise<string>((resolve) => {
    resolvers.push(resolve);
  });
  // A test that fails before settling the read must not leave it pending for the next test.
  onTestFinished(() => {
    for (const resolve of resolvers) {
      resolve('');
    }
  });
  return {
    promise,
    resolve(content: string): void {
      for (const resolve of resolvers) {
        resolve(content);
      }
    }
  };
}

function createFixture(): Fixture {
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('d');
  mockApp.vault.createFolderSync__('d/sub');
  mockApp.vault.createSync__('d/sub/x.md', '');
  mockApp.vault.createSync__('d/a.md', '');
  mockApp.vault.createSync__('d/b.png', '');
  mockApp.vault.createSync__('d/d.md', FOLDER_NOTE_CONTENT);
  mockApp.vault.createFolderSync__('empty');
  const app = mockApp.asOriginalType__();

  const leaf = app.workspace.getLeaf(false);
  const updateHeader = vi.fn();
  leaf.updateHeader = updateHeader;
  const newTabLeaf = castTo<WorkspaceLeaf>({ id: 'new-tab' });
  vi.spyOn(app.workspace, 'getLeaf').mockImplementation((paneType) => paneType ? newTabLeaf : leaf);

  const siblingNavigator = new SiblingNavigator({ app, getPageSize: (): number => 10 });
  const navigate = vi.fn(() => noopAsync());
  const open = vi.fn(() => noopAsync());
  siblingNavigator.navigate = navigate;
  siblingNavigator.open = open;

  const highlightTarget = vi.fn();
  const show = vi.fn(() => noopAsync());
  const folderMapComponent = castTo<FolderMapComponent>({ highlightTarget, show });

  const settings: Settings = {
    shouldReadFolderNotePlugins: true,
    shouldUseFolderNoteBeside: true,
    shouldUseFolderNoteInside: true,
    showBottomBar: true,
    showTopBar: true
  };

  const view = new VirtualFolderNoteView({
    folderMapComponent,
    getSettings: (): Settings => settings,
    leaf,
    siblingNavigator
  });
  // `ItemView.titleEl` is Obsidian's own header title, which the mock does not model.
  view.titleEl = createDiv();

  return { app, highlightTarget, leaf, mockApp, navigate, newTabLeaf, open, settings, show, updateHeader, view };
}

function getBarButton(view: VirtualFolderNoteView, placement: string, action: string): HTMLButtonElement {
  return castTo<HTMLButtonElement>(query(view, `.sibling-notes-navigator-bar[data-placement="${placement}"] button[data-action="${action}"]`));
}

function getBarPlacements(view: VirtualFolderNoteView): (string | undefined)[] {
  return Array.from(view.contentEl.querySelectorAll<HTMLElement>(':scope .sibling-notes-navigator-bar'), (el) => el.dataset['placement']);
}

function getEnterButton(view: VirtualFolderNoteView): HTMLButtonElement {
  return castTo<HTMLButtonElement>(query(view, '.sibling-notes-virtual-folder-note-enter'));
}

function getFile(app: AppOriginal, path: string): TFile {
  const file = app.vault.getFileByPath(path);
  if (!file) {
    throw new Error(`No ${path}.`);
  }
  return file;
}

function getFolder(app: AppOriginal, path: string): TFolder {
  const folder = app.vault.getFolderByPath(path);
  if (!folder) {
    throw new Error(`No ${path}.`);
  }
  return folder;
}

function getItem(view: VirtualFolderNoteView, path: string): HTMLElement {
  return query(view, `.sibling-notes-virtual-folder-note-item[data-path="${CSS.escape(path)}"]`);
}

function getItemTexts(view: VirtualFolderNoteView): (null | string)[] {
  return Array.from(view.contentEl.querySelectorAll('.sibling-notes-virtual-folder-note-item'), (el) => el.textContent);
}

function getOpenedPaths(open: ReturnType<typeof vi.fn>): [string, unknown][] {
  return open.mock.calls.map((call) => [castTo<TAbstractFile>(call[0]).path, call[1]]);
}

function getRenderedComponent(index: number): Component {
  const component = vi.mocked(fullRender).mock.calls[index]?.[0].component;
  if (!component) {
    throw new Error(`No render ${String(index)}.`);
  }
  return component;
}

function getRenderedMarkdowns(): string[] {
  return vi.mocked(fullRender).mock.calls.map((call) => call[0].markdown);
}

async function openView(fixture: Fixture, folderPath: null | string): Promise<void> {
  await fixture.leaf.open(fixture.view);
  if (folderPath !== null) {
    await fixture.view.setState({ folderPath }, { history: false });
  }
}

function query(view: VirtualFolderNoteView, selector: string): HTMLElement {
  const el = view.contentEl.querySelector<HTMLElement>(selector);
  if (!el) {
    throw new Error(`No ${selector}.`);
  }
  return el;
}

describe('VirtualFolderNoteView', () => {
  let fixture: Fixture;

  beforeEach(() => {
    vi.mocked(fullRender).mockClear();
    addIcon('folder', '<circle r="1"/>');
    addIcon('file', '<rect width="1" height="1"/>');
    fixture = createFixture();
  });

  it('names itself after its folder and saves the folder in its state, which restores it', async () => {
    const { app, view } = fixture;
    expect(view.getViewType()).toBe(VIRTUAL_FOLDER_NOTE_VIEW_TYPE);
    expect(view.getIcon()).toBe('folder');
    expect(view.navigation).toBe(true);
    expect(view.folder).toBeNull();
    expect(view.getDisplayText()).toBe('Folder');
    expect(view.getState()).not.toHaveProperty('folderPath');

    const folder = getFolder(app, 'd/sub');
    expect(VirtualFolderNoteView.createState(folder)).toStrictEqual({ folderPath: 'd/sub' });
    await view.setState(VirtualFolderNoteView.createState(folder), { history: false });
    expect(view.folder).toBe(folder);
    expect(view.getDisplayText()).toBe('sub');
    expect(view.getState()).toMatchObject({ folderPath: 'd/sub' });
  });

  it('saves the folder\'s current path, so a renamed folder is restored under its new name', async () => {
    const { app, view } = fixture;
    const folder = getFolder(app, 'd');
    await view.setState(VirtualFolderNoteView.createState(folder), { history: false });
    await app.vault.rename(folder, 'renamed');
    expect(view.getState()).toMatchObject({ folderPath: 'renamed' });
  });

  it('stands for no folder when the state names none, or names one that does not exist', async () => {
    const { view } = fixture;
    // A path that is not a string is a malformed state, even one that would look up a real folder.
    for (const state of ['d', null, {}, { folderPath: 1 }, { folderPath: ['d'] }, { folderPath: 'missing' }]) {
      await view.setState({ folderPath: 'd' }, { history: false });
      expect(view.folder?.path).toBe('d');
      await view.setState(state, { history: false });
      expect(view.folder).toBeNull();
    }
  });

  it('shows a state set before it opens once it opens', async () => {
    const { updateHeader, view } = fixture;
    await view.setState({ folderPath: 'd' }, { history: false });
    expect(updateHeader).toHaveBeenCalled();
    expect(view.titleEl.textContent).toBe('d');
    expect(view.contentEl.childElementCount).toBe(0);
    await fixture.leaf.open(view);
    expect(view.containerEl.hasClass('sibling-notes-virtual-folder-note')).toBe(true);
    expect(getItemTexts(view)).toStrictEqual(['sub', 'a', 'b.png', 'd']);
  });

  it('lists the folder\'s items in explorer order, each with its icon, under the folder\'s name', async () => {
    const { updateHeader, view } = fixture;
    await openView(fixture, 'd');
    expect(query(view, '.sibling-notes-virtual-folder-note-title').textContent).toBe('d');
    expect(view.titleEl.textContent).toBe('d');
    expect(updateHeader).toHaveBeenCalled();
    expect(getItemTexts(view)).toStrictEqual(['sub', 'a', 'b.png', 'd']);
    const iconClasses = Array.from(
      view.contentEl.querySelectorAll(':scope .sibling-notes-virtual-folder-note-item-icon svg'),
      (svg) => svg.classList.contains('folder') ? 'folder' : 'file'
    );
    expect(iconClasses).toStrictEqual(['folder', 'file', 'file', 'file']);
    expect(getEnterButton(view).disabled).toBe(false);
    expect(view.contentEl.querySelector('.sibling-notes-virtual-folder-note-empty')).toBeNull();
  });

  it('opens a clicked item here, and in a new tab on a mod-click or a middle click', async () => {
    const { leaf, newTabLeaf, open, view } = fixture;
    await openView(fixture, 'd');
    getItem(view, 'd/a.md').dispatchEvent(new MouseEvent('click', { cancelable: true }));
    getItem(view, 'd/sub').dispatchEvent(new MouseEvent('click', { cancelable: true, ctrlKey: true, metaKey: true }));
    getItem(view, 'd/b.png').dispatchEvent(new MouseEvent('auxclick', { button: 1, cancelable: true }));
    // A right click opens the context menu, not the item.
    getItem(view, 'd/d.md').dispatchEvent(new MouseEvent('auxclick', { button: 2, cancelable: true }));
    expect(getOpenedPaths(open)).toStrictEqual([
      ['d/a.md', leaf],
      ['d/sub', newTabLeaf],
      ['d/b.png', newTabLeaf]
    ]);
  });

  it('keeps the link from navigating on its own when an item is clicked', async () => {
    const { view } = fixture;
    await openView(fixture, 'd');
    const clickEvent = new MouseEvent('click', { cancelable: true });
    getItem(view, 'd/a.md').dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('enters the folder from the Enter button', async () => {
    const { app, leaf, navigate, view } = fixture;
    await openView(fixture, 'd');
    getEnterButton(view).click();
    expect(navigate).toHaveBeenCalledWith(NavigationAction.Enter, { item: getFolder(app, 'd'), leaf });
  });

  it('says an empty folder is empty, with nothing to enter', async () => {
    const { view } = fixture;
    await openView(fixture, 'empty');
    expect(getItemTexts(view)).toStrictEqual([]);
    expect(query(view, '.sibling-notes-virtual-folder-note-empty').textContent).toBe('This folder is empty.');
    const enterButton = getEnterButton(view);
    expect(enterButton.disabled).toBe(true);
    expect(enterButton.style.display).toBe('');
  });

  it('says so when its folder is deleted, with no Enter button and no items', async () => {
    const { app, view } = fixture;
    await openView(fixture, 'd');
    await app.fileManager.trashFile(getFolder(app, 'd'));
    view.refresh();
    expect(view.folder).toBeNull();
    expect(view.titleEl.textContent).toBe('Folder');
    expect(query(view, '.sibling-notes-virtual-folder-note-title').textContent).toBe('This folder no longer exists.');
    expect(getEnterButton(view).style.display).toBe('none');
    expect(getItemTexts(view)).toStrictEqual([]);
    // A folder that no longer exists is not an empty one.
    expect(view.contentEl.querySelector('.sibling-notes-virtual-folder-note-empty')).toBeNull();
  });

  it('puts a bar above and below the page, showing the folder\'s position, and hides either one by setting', async () => {
    const { settings, view } = fixture;
    await openView(fixture, 'd/sub');
    const pageEl = query(view, '.sibling-notes-virtual-folder-note-content');
    expect(Array.from(pageEl.querySelectorAll<HTMLElement>(':scope > *'), (el) => el.dataset['placement'] ?? null)).toStrictEqual([
      'top',
      null,
      null,
      null,
      null,
      'bottom'
    ]);
    expect(Array.from(view.contentEl.querySelectorAll('.sibling-notes-navigator-bar-position'), (el) => el.textContent)).toStrictEqual(['1 / 4', '1 / 4']);
    // `d/sub` is the first item of `d`, so there is nothing before it.
    expect(getBarButton(view, 'top', 'previous').disabled).toBe(true);
    expect(getBarButton(view, 'bottom', 'next').disabled).toBe(false);

    settings.showTopBar = false;
    view.refresh();
    expect(getBarPlacements(view)).toStrictEqual(['bottom']);

    settings.showTopBar = true;
    settings.showBottomBar = false;
    view.refresh();
    expect(getBarPlacements(view)).toStrictEqual(['top']);
  });

  it('moves, highlights a hovered button\'s target and shows the folder map from its bars', async () => {
    const { app, highlightTarget, leaf, navigate, show, view } = fixture;
    await openView(fixture, 'd/sub');
    const folder = getFolder(app, 'd/sub');

    getBarButton(view, 'bottom', 'next').click();
    expect(navigate).toHaveBeenCalledWith(NavigationAction.Next, { item: folder, leaf });

    const nextButton = getBarButton(view, 'top', 'next');
    nextButton.dispatchEvent(new MouseEvent('mouseenter'));
    nextButton.dispatchEvent(new MouseEvent('mouseleave'));
    expect(highlightTarget.mock.calls).toStrictEqual([[NavigationAction.Next, folder], [null, folder]]);

    const mapButton = getBarButton(view, 'top', 'map');
    mapButton.click();
    expect(show).toHaveBeenCalledWith(leaf, mapButton);
  });

  it('shows the folder note without its frontmatter, under a title that opens it', async () => {
    const { app, leaf, open, view } = fixture;
    await openView(fixture, 'd');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toStrictEqual(['About d.']);
    });
    const renderParams = vi.mocked(fullRender).mock.calls[0]?.[0];
    expect(renderParams?.sourcePath).toBe('d/d.md');
    expect(renderParams?.shouldRegisterLinkHandlers).toBe(true);
    expect(renderParams?.el.hasClass('sibling-notes-virtual-folder-note-folder-note-body')).toBe(true);

    const titleEl = query(view, '.sibling-notes-virtual-folder-note-folder-note-title');
    expect(titleEl.textContent).toBe('d');
    titleEl.click();
    expect(getOpenedPaths(open)).toStrictEqual([['d/d.md', leaf]]);
    expect(open.mock.calls[0]?.[0]).toBe(getFile(app, 'd/d.md'));
  });

  it('embeds a folder note that is not Markdown', async () => {
    const { mockApp } = fixture;
    mockApp.vault.createSync__('empty/empty.canvas', '{}');
    mockApp.plugins.registerPlugin__(
      'folder-notes',
      castTo<Plugin>({
        settings: { folderNoteName: '{{folder_name}}', folderNoteType: '.canvas', storageLocation: 'insideFolder', supportedFileTypes: ['canvas'] }
      })
    );
    await openView(fixture, 'empty');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toStrictEqual(['![[empty/empty.canvas]]']);
    });
  });

  it('renders the folder note again only when it changes', async () => {
    const { app, view } = fixture;
    await openView(fixture, 'd');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toHaveLength(1);
    });

    view.refresh();
    await app.vault.modify(getFile(app, 'd/a.md'), 'other');
    await noopAsync();
    expect(getRenderedMarkdowns()).toHaveLength(1);

    await app.vault.modify(getFile(app, 'd/d.md'), 'Changed.');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toStrictEqual(['About d.', 'Changed.']);
    });
    // The first render's component is released when the second replaces it.
    expect(getRenderedComponent(0)._loaded).toBe(false);
    expect(getRenderedComponent(1)._loaded).toBe(true);
    expect(view.contentEl.querySelectorAll('.sibling-notes-virtual-folder-note-folder-note-body')).toHaveLength(1);
  });

  it('renders the folder note again when it moves with its renamed folder', async () => {
    const { app, mockApp, view } = fixture;
    mockApp.vault.createSync__('d/!.md', 'Index.');
    mockApp.plugins.registerPlugin__('obsidian-folder-index', castTo<Plugin>({ settings: { indexFilename: '!', indexFileUserSpecified: true } }));
    await openView(fixture, 'd');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toStrictEqual(['Index.']);
    });

    await app.vault.rename(getFolder(app, 'd'), 'e');
    view.refresh();
    expect(view.titleEl.textContent).toBe('e');
    await vi.waitFor(() => {
      expect(vi.mocked(fullRender).mock.calls.map((call) => call[0].sourcePath)).toStrictEqual(['d/!.md', 'e/!.md']);
    });
  });

  it('drops the folder note when the folder loses it', async () => {
    const { app, view } = fixture;
    await openView(fixture, 'd');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toHaveLength(1);
    });
    await app.fileManager.trashFile(getFile(app, 'd/d.md'));
    view.refresh();
    expect(query(view, '.sibling-notes-virtual-folder-note-folder-note').childElementCount).toBe(0);
    expect(getRenderedComponent(0)._loaded).toBe(false);
  });

  it('does not render a folder note that was replaced before it was read', async () => {
    const { app } = fixture;
    const { promise: firstRead, resolve: resolveFirstRead } = createDeferredContent();
    vi.spyOn(app.vault, 'cachedRead').mockReturnValueOnce(firstRead);
    await openView(fixture, 'd');
    await app.vault.modify(getFile(app, 'd/d.md'), 'Changed.');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toStrictEqual(['Changed.']);
    });
    resolveFirstRead('Stale.');
    await firstRead;
    await noopAsync();
    expect(getRenderedMarkdowns()).toStrictEqual(['Changed.']);
  });

  it('releases the folder note when it closes', async () => {
    const { view } = fixture;
    await openView(fixture, 'd');
    await vi.waitFor(() => {
      expect(getRenderedMarkdowns()).toHaveLength(1);
    });
    expect(getRenderedComponent(0)._loaded).toBe(true);
    await view.close();
    expect(getRenderedComponent(0)._loaded).toBe(false);
  });

  it('does not render the folder note into a view closed while the note was being read', async () => {
    const { app, view } = fixture;
    const { promise: read, resolve: resolveRead } = createDeferredContent();
    vi.spyOn(app.vault, 'cachedRead').mockReturnValueOnce(read);
    await openView(fixture, 'd');
    await view.close();
    resolveRead('Late.');
    await read;
    await noopAsync();
    expect(getRenderedMarkdowns()).toStrictEqual([]);
  });

  it('closes without error when the folder has no folder note', async () => {
    const { view } = fixture;
    await openView(fixture, 'empty');
    await expect(view.close()).resolves.toBeUndefined();
    expect(getRenderedMarkdowns()).toStrictEqual([]);
  });
});
