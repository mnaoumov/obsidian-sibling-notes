import type {
  MarkdownEditView as MarkdownEditViewOriginal,
  MarkdownSubView,
  MarkdownView as MarkdownViewOriginal,
  TFile,
  WorkspaceLeaf
} from 'obsidian';
import type { Mock } from 'vitest';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  App,
  MarkdownEditView,
  MarkdownView
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FolderMapComponent } from '../folder-map/folder-map-component.ts';
import type { SiblingNavigator } from '../navigation/sibling-navigator.ts';
import type { NavigatorBarVisibility } from './navigator-bar-component.ts';

import { NavigationAction } from '../navigation/navigation-action.ts';
import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from '../virtual-folder-note/virtual-folder-note-view.ts';
import { NavigatorBarComponent } from './navigator-bar-component.ts';
import { MAP_BUTTON_ACTION } from './navigator-bar.ts';

interface EditorDom {
  readonly contentContainerEl: HTMLElement;
  readonly contentEl: HTMLElement;
  readonly inlineTitleEl: HTMLElement;
  readonly onResize: Mock<() => void>;
  readonly sizerEl: HTMLElement;
}

interface Fixture {
  readonly app: App;
  readonly component: NavigatorBarComponent;
  readonly explorerLeaves: WorkspaceLeaf[];
  readonly file: TFile;
  readonly folderMapComponent: FolderMapStub;
  readonly markdownLeaves: WorkspaceLeaf[];
  readonly navigate: Mock<SiblingNavigator['navigate']>;
  readonly virtualLeaves: WorkspaceLeaf[];
  visibility: NavigatorBarVisibility;
}

interface FolderMapStub {
  readonly highlightTarget: Mock<FolderMapComponent['highlightTarget']>;
  readonly refresh: Mock<FolderMapComponent['refresh']>;
  readonly show: Mock<FolderMapComponent['show']>;
}

interface PreviewDom {
  readonly footerEl: HTMLElement;
  readonly headerEl: HTMLElement;
  readonly renderer: RendererStub;
}

interface RendererSectionStub {
  readonly el: HTMLElement;
}

interface RendererStub {
  footer: null | RendererSectionStub;
  header: null | RendererSectionStub;
  readonly updateFooter: Mock<() => void>;
  readonly updateHeader: Mock<() => void>;
}

interface TestView {
  readonly editor: EditorDom;
  readonly preview: PreviewDom;
  readonly view: MarkdownViewOriginal;
}

interface WithCurrentMode {
  currentMode: MarkdownSubView;
}

const BAR_SELECTOR = '.sibling-notes-navigator-bar';
const REFRESH_DELAY_IN_MILLISECONDS = 50;
const SCROLL_PAST_END_CSS_PROPERTY = '--sibling-notes-scroll-past-end';
const SCROLL_PAST_END_HEIGHT = 300;
const SCROLL_PAST_END_PADDING = `${String(SCROLL_PAST_END_HEIGHT)}px`;

/**
 * Stands in for Obsidian's sort of the File explorer, which the component patches. Its `getSortedFolderItems` is
 * what tells a loaded File explorer view from a deferred one.
 */
class FileExplorerViewStub {
  public getSortedFolderItems(): [] {
    return [];
  }

  public sort(): void {
    this.getSortedFolderItems();
  }
}

const ORIGINAL_EXPLORER_SORT = FileExplorerViewStub.prototype.sort;

// Obsidian's own `MarkdownView.setMode` and `MarkdownEditView.updateBottomPadding`, which the test mocks do not
// model: a mode switch makes the mode current, and the editor puts its scroll-past-end space on the content's
// bottom padding.
async function setModeStub(this: MarkdownViewOriginal, mode: MarkdownSubView): Promise<void> {
  await noopAsync();
  castTo<WithCurrentMode>(this).currentMode = mode;
}

function updateBottomPaddingStub(this: MarkdownEditViewOriginal, height: number): void {
  this.cm.contentDOM.setCssStyles({ paddingBottom: `${String(height)}px` });
}

describe('NavigatorBarComponent', () => {
  let fixture: Fixture;
  const editViewPrototype = castTo<Record<string, unknown>>(MarkdownEditView.prototype);
  const markdownViewPrototype = castTo<Record<string, unknown>>(MarkdownView.prototype);

  beforeEach(() => {
    vi.useFakeTimers();
    markdownViewPrototype['setMode'] = setModeStub;
    editViewPrototype['updateBottomPadding'] = updateBottomPaddingStub;
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.component.unload();
    delete markdownViewPrototype['setMode'];
    delete editViewPrototype['updateBottomPadding'];
    vi.useRealTimers();
  });

  function createTestView(): TestView {
    const view = MarkdownView.create2__(fixture.app.workspace.getLeaf(true)).asOriginalType7__();
    view.file = fixture.file;

    const sizerEl = createDiv({ cls: 'cm-sizer' });
    const inlineTitleEl = sizerEl.createDiv({ cls: 'inline-title' });
    const contentContainerEl = sizerEl.createDiv({ cls: 'cm-contentContainer' });
    const contentEl = contentContainerEl.createDiv({ cls: 'cm-content' });
    const onResize = vi.fn<() => void>();
    // In Obsidian the edit mode's `view` is the view itself; the mock hands it the view before wrapping it.
    Object.assign(view.editMode, { cm: { contentDOM: contentEl }, onResize, sizerEl, view });

    const headerEl = createDiv({ cls: 'mod-header' });
    headerEl.createDiv({ cls: 'inline-title' });
    const footerEl = createDiv({ cls: 'mod-footer' });
    footerEl.createDiv({ cls: 'embedded-backlinks' });
    const renderer: RendererStub = {
      footer: { el: footerEl },
      header: { el: headerEl },
      updateFooter: vi.fn<() => void>(),
      updateHeader: vi.fn<() => void>()
    };
    Object.assign(view.previewMode, { renderer });

    return {
      editor: { contentContainerEl, contentEl, inlineTitleEl, onResize, sizerEl },
      preview: { footerEl, headerEl, renderer },
      view
    };
  }

  function openView(): TestView {
    const testView = createTestView();
    fixture.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: testView.view }));
    return testView;
  }

  function loadAndRefresh(): void {
    fixture.component.load();
    fixture.app.workspace.setLayoutReady__();
  }

  function getBars(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>(BAR_SELECTOR)];
  }

  function getButton(barEl: Element | null | undefined, action: string): HTMLButtonElement {
    const button = barEl?.querySelector<HTMLButtonElement>(`button[data-action="${CSS.escape(action)}"]`);
    if (!button) {
      throw new Error(`No ${action} button.`);
    }
    return button;
  }

  function getPlacement(el: Element | null | undefined): string | undefined {
    return el instanceof HTMLElement ? el.dataset['placement'] : undefined;
  }

  function showPreview(testView: TestView): void {
    Object.assign(testView.view, { currentMode: testView.view.previewMode });
  }

  it('puts the top bar before the inline title and the bottom bar right after the editor\'s content once the layout is ready', () => {
    const { editor } = openView();
    fixture.component.load();
    expect(getBars(editor.sizerEl)).toHaveLength(0);

    fixture.app.workspace.setLayoutReady__();

    const top = editor.sizerEl.firstElementChild;
    const bottom = editor.contentContainerEl.nextElementSibling;
    expect(getPlacement(top)).toBe('top');
    expect(getPlacement(bottom)).toBe('bottom');
    expect(top?.nextElementSibling).toBe(editor.inlineTitleEl);
    // The bars changed the editor's height, so it re-measures and re-runs its bottom padding.
    expect(editor.onResize).toHaveBeenCalledTimes(1);
  });

  it('shows the position and enables only the buttons that have somewhere to go', () => {
    const { editor } = openView();
    loadAndRefresh();

    const [top, bottom] = getBars(editor.sizerEl);
    for (const barEl of [top, bottom]) {
      expect(barEl?.querySelector('.sibling-notes-navigator-bar-position')?.textContent).toBe('2 / 5');
      expect(getButton(barEl, NavigationAction.Next).disabled).toBe(false);
      expect(getButton(barEl, NavigationAction.Previous).disabled).toBe(true);
    }
  });

  it('navigates, highlights and shows the map from the note the bar belongs to', () => {
    const { editor, view } = openView();
    loadAndRefresh();
    const [top] = getBars(editor.sizerEl);

    getButton(top, NavigationAction.Next).click();
    expect(fixture.navigate).toHaveBeenCalledWith(NavigationAction.Next, { item: fixture.file, leaf: view.leaf });

    getButton(top, NavigationAction.Next).dispatchEvent(new MouseEvent('mouseenter'));
    expect(fixture.folderMapComponent.highlightTarget).toHaveBeenCalledWith(NavigationAction.Next, fixture.file);

    const mapButton = getButton(top, MAP_BUTTON_ACTION);
    mapButton.click();
    expect(fixture.folderMapComponent.show).toHaveBeenCalledWith(view.leaf, mapButton);
  });

  it('keeps one pair of bars per note across refreshes, and leaves the editor alone when nothing moved', () => {
    const { editor } = openView();
    loadAndRefresh();
    const barsBefore = getBars(editor.sizerEl);

    fixture.component.refresh();

    expect(getBars(editor.sizerEl)).toStrictEqual(barsBefore);
    expect(editor.onResize).toHaveBeenCalledTimes(1);
  });

  it('moves the editor\'s scroll-past-end space below the bottom bar, so the bar stays right under the last line', () => {
    const { editor, view } = openView();
    loadAndRefresh();
    // A second refresh must not stack a second patch, which would move the already-moved space again.
    fixture.component.refresh();

    view.editMode.updateBottomPadding(SCROLL_PAST_END_HEIGHT);

    const bottom = editor.contentContainerEl.nextElementSibling;
    expect(castTo<HTMLElement>(bottom).style.getPropertyValue(SCROLL_PAST_END_CSS_PROPERTY)).toBe(SCROLL_PAST_END_PADDING);
    expect(editor.contentEl.style.paddingBottom).toBe('0px');
  });

  it('leaves the scroll-past-end space on the content when the bottom bar is not in the editor', () => {
    fixture.visibility = { showBottomBar: false, showTopBar: true };
    const { editor, view } = openView();
    loadAndRefresh();

    view.editMode.updateBottomPadding(SCROLL_PAST_END_HEIGHT);
    expect(editor.contentEl.style.paddingBottom).toBe(SCROLL_PAST_END_PADDING);

    // A note with no bars at all, such as one opened since the last refresh, keeps it too.
    const unseen = createTestView();
    unseen.view.editMode.updateBottomPadding(SCROLL_PAST_END_HEIGHT);
    expect(unseen.editor.contentEl.style.paddingBottom).toBe(SCROLL_PAST_END_PADDING);
  });

  it('starts the header and the footer with the bars in Reading view, and re-measures both', () => {
    const testView = openView();
    showPreview(testView);
    loadAndRefresh();

    const { footerEl, headerEl, renderer } = testView.preview;
    expect(getPlacement(headerEl.firstElementChild)).toBe('top');
    expect(getPlacement(footerEl.firstElementChild)).toBe('bottom');
    expect(renderer.updateHeader).toHaveBeenCalledTimes(1);
    expect(renderer.updateFooter).toHaveBeenCalledTimes(1);

    // Already in place: neither section changed, so neither is re-measured.
    fixture.component.refresh();
    expect(renderer.updateHeader).toHaveBeenCalledTimes(1);
    expect(renderer.updateFooter).toHaveBeenCalledTimes(1);
  });

  it('re-places the bars after every mode switch', async () => {
    const testView = openView();
    loadAndRefresh();
    const { editor, preview, view } = testView;
    view.editMode.updateBottomPadding(SCROLL_PAST_END_HEIGHT);

    await view.setMode(view.previewMode);
    expect(getBars(editor.sizerEl)).toHaveLength(0);
    const bottom = castTo<HTMLElement>(preview.footerEl.firstElementChild);
    expect(getPlacement(preview.headerEl.firstElementChild)).toBe('top');
    expect(bottom.dataset['placement']).toBe('bottom');
    // The editor's scroll-past-end space does not follow the bar into Reading view.
    expect(bottom.style.getPropertyValue(SCROLL_PAST_END_CSS_PROPERTY)).toBe('');

    await view.setMode(view.editMode);
    expect(getPlacement(editor.sizerEl.firstElementChild)).toBe('top');
    expect(editor.contentContainerEl.nextElementSibling).toBe(bottom);
    expect(getBars(preview.headerEl)).toHaveLength(0);
    expect(getBars(preview.footerEl)).toHaveLength(0);
  });

  it('puts the top bar back before the inline title when Obsidian prepends the title again', async () => {
    const { editor, view } = openView();
    loadAndRefresh();
    const top = editor.sizerEl.firstElementChild;

    // Showing the editor prepends the inline title to .cm-sizer.
    editor.sizerEl.prepend(editor.inlineTitleEl);
    await view.setMode(view.editMode);

    expect(editor.sizerEl.firstElementChild).toBe(top);
    expect(top?.nextElementSibling).toBe(editor.inlineTitleEl);
  });

  it('does not place bars on a mode switch of a note it has not seen yet', async () => {
    loadAndRefresh();
    const { editor, view } = createTestView();

    await view.setMode(view.editMode);

    expect(getBars(editor.sizerEl)).toHaveLength(0);
  });

  it('hides either bar per the settings in the editor, and clears the space it carried', () => {
    const { editor, view } = openView();
    loadAndRefresh();
    view.editMode.updateBottomPadding(SCROLL_PAST_END_HEIGHT);
    const bottom = castTo<HTMLElement>(editor.contentContainerEl.nextElementSibling);
    editor.onResize.mockClear();

    fixture.visibility = { showBottomBar: false, showTopBar: true };
    fixture.component.refresh();
    expect(bottom.parentElement).toBeNull();
    expect(bottom.style.getPropertyValue(SCROLL_PAST_END_CSS_PROPERTY)).toBe('');
    expect(editor.onResize).toHaveBeenCalledTimes(1);

    // Already hidden: nothing moved, so the editor is not re-measured.
    fixture.component.refresh();
    expect(editor.onResize).toHaveBeenCalledTimes(1);

    fixture.visibility = { showBottomBar: true, showTopBar: false };
    fixture.component.refresh();
    expect(getBars(editor.sizerEl).map((el) => el.dataset['placement'])).toStrictEqual(['bottom']);
    expect(editor.onResize).toHaveBeenCalledTimes(2);
  });

  it('hides either bar per the settings in Reading view, re-measuring only the section that changed', () => {
    const testView = openView();
    showPreview(testView);
    loadAndRefresh();
    const { footerEl, headerEl, renderer } = testView.preview;
    renderer.updateHeader.mockClear();
    renderer.updateFooter.mockClear();

    fixture.visibility = { showBottomBar: true, showTopBar: false };
    fixture.component.refresh();

    expect(getBars(headerEl)).toHaveLength(0);
    expect(getBars(footerEl)).toHaveLength(1);
    expect(renderer.updateHeader).toHaveBeenCalledTimes(1);
    expect(renderer.updateFooter).not.toHaveBeenCalled();
  });

  it('skips a Reading view section the renderer does not have', () => {
    const testView = openView();
    showPreview(testView);
    const { footerEl, headerEl, renderer } = testView.preview;
    renderer.header = null;
    loadAndRefresh();

    expect(getBars(headerEl)).toHaveLength(0);
    expect(renderer.updateHeader).not.toHaveBeenCalled();
    expect(getBars(footerEl)).toHaveLength(1);

    renderer.header = { el: headerEl };
    renderer.footer = null;
    fixture.component.refresh();
    expect(getBars(headerEl)).toHaveLength(1);
    expect(renderer.updateFooter).toHaveBeenCalledTimes(1);
  });

  it('places no bars in an editor whose content is not attached yet', () => {
    const { editor } = openView();
    editor.contentEl.detach();
    loadAndRefresh();

    expect(getBars(editor.sizerEl)).toHaveLength(0);
    expect(editor.onResize).not.toHaveBeenCalled();
  });

  it('ignores leaves whose view is still deferred', () => {
    fixture.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: {} }));
    fixture.virtualLeaves.push(castTo<WorkspaceLeaf>({ view: {} }));
    const { editor } = openView();
    loadAndRefresh();

    expect(getBars(editor.sizerEl)).toHaveLength(2);
  });

  it('takes the bars out of a closed note and re-measures the editor it left', () => {
    const { editor, preview } = openView();
    loadAndRefresh();
    const bars = getBars(editor.sizerEl);
    editor.onResize.mockClear();

    fixture.markdownLeaves.length = 0;
    fixture.component.refresh();

    expect(bars.map((el) => el.parentElement)).toStrictEqual([null, null]);
    expect(editor.onResize).toHaveBeenCalledTimes(1);

    // The closed note is forgotten: a later refresh has nothing of it left to take out or re-measure.
    fixture.component.refresh();
    expect(editor.onResize).toHaveBeenCalledTimes(1);
    expect(preview.renderer.updateHeader).not.toHaveBeenCalled();
    expect(preview.renderer.updateFooter).not.toHaveBeenCalled();
  });

  it.each(
    [
      ['bottom', { showBottomBar: true, showTopBar: false }],
      ['top', { showBottomBar: false, showTopBar: true }]
    ] as const
  )('re-measures the editor when only the %s bar was in it', (_placement, visibility) => {
    fixture.visibility = visibility;
    const { editor } = openView();
    loadAndRefresh();
    expect(getBars(editor.sizerEl)).toHaveLength(1);
    editor.onResize.mockClear();

    fixture.markdownLeaves.length = 0;
    fixture.component.refresh();

    expect(getBars(editor.sizerEl)).toHaveLength(0);
    expect(editor.onResize).toHaveBeenCalledTimes(1);
  });

  it('takes the bars out of a closed note in Reading view and re-measures both sections', () => {
    const testView = openView();
    showPreview(testView);
    loadAndRefresh();
    const { footerEl, headerEl, renderer } = testView.preview;
    renderer.updateHeader.mockClear();
    renderer.updateFooter.mockClear();

    fixture.markdownLeaves.length = 0;
    fixture.component.refresh();

    expect(getBars(headerEl)).toHaveLength(0);
    expect(getBars(footerEl)).toHaveLength(0);
    expect(renderer.updateHeader).toHaveBeenCalledTimes(1);
    expect(renderer.updateFooter).toHaveBeenCalledTimes(1);
    expect(testView.editor.onResize).not.toHaveBeenCalled();
  });

  it('refreshes every open virtual folder note and folder map', () => {
    const virtualView = castTo<VirtualFolderNoteView>(Object.create(VirtualFolderNoteView.prototype));
    const refreshVirtualView = vi.fn<VirtualFolderNoteView['refresh']>();
    virtualView.refresh = refreshVirtualView;
    fixture.virtualLeaves.push(castTo<WorkspaceLeaf>({ view: virtualView }));
    loadAndRefresh();

    expect(refreshVirtualView).toHaveBeenCalledTimes(1);
    expect(fixture.folderMapComponent.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(
    [
      ['layout-change', 'workspace'],
      ['file-open', 'workspace'],
      ['active-leaf-change', 'workspace'],
      ['create', 'vault'],
      ['delete', 'vault'],
      ['rename', 'vault']
    ] as const
  )('refreshes once, shortly after a burst of %s events', (eventName, source) => {
    const testView = createTestView();
    loadAndRefresh();
    // Settles whatever creating the leaf set off, so only the event under test can refresh.
    vi.advanceTimersByTime(REFRESH_DELAY_IN_MILLISECONDS);
    fixture.folderMapComponent.refresh.mockClear();
    fixture.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: testView.view }));
    const { editor } = testView;

    for (let index = 0; index < 3; index++) {
      fixture.app[source].trigger(eventName);
    }
    expect(fixture.folderMapComponent.refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REFRESH_DELAY_IN_MILLISECONDS);

    expect(fixture.folderMapComponent.refresh).toHaveBeenCalledTimes(1);
    expect(getBars(editor.sizerEl)).toHaveLength(2);
  });

  it('refreshes after the File explorer re-sorts, once its view is loaded', () => {
    loadAndRefresh();
    const explorerView = new FileExplorerViewStub();
    fixture.explorerLeaves.push(castTo<WorkspaceLeaf>({ view: explorerView }));
    fixture.component.refresh();
    fixture.component.refresh();
    fixture.folderMapComponent.refresh.mockClear();

    explorerView.sort();
    vi.advanceTimersByTime(REFRESH_DELAY_IN_MILLISECONDS);

    expect(fixture.folderMapComponent.refresh).toHaveBeenCalledTimes(1);
  });

  it('takes out every bar and every patch on unload, and drops a pending refresh', async () => {
    const { editor, view } = openView();
    const explorerView = new FileExplorerViewStub();
    fixture.explorerLeaves.push(castTo<WorkspaceLeaf>({ view: explorerView }));
    loadAndRefresh();
    fixture.app.workspace.trigger('layout-change');
    fixture.folderMapComponent.refresh.mockClear();

    fixture.component.unload();

    expect(getBars(editor.sizerEl)).toHaveLength(0);
    expect(markdownViewPrototype['setMode']).toBe(setModeStub);
    expect(editViewPrototype['updateBottomPadding']).toBe(updateBottomPaddingStub);
    expect(Object.hasOwn(explorerView, 'sort')).toBe(false);
    expect(FileExplorerViewStub.prototype.sort).toBe(ORIGINAL_EXPLORER_SORT);
    vi.advanceTimersByTime(REFRESH_DELAY_IN_MILLISECONDS);
    explorerView.sort();
    vi.advanceTimersByTime(REFRESH_DELAY_IN_MILLISECONDS);
    expect(fixture.folderMapComponent.refresh).not.toHaveBeenCalled();

    await view.setMode(view.editMode);
    view.editMode.updateBottomPadding(SCROLL_PAST_END_HEIGHT);
    expect(getBars(editor.sizerEl)).toHaveLength(0);
    expect(editor.contentEl.style.paddingBottom).toBe(SCROLL_PAST_END_PADDING);
  });

  function createFixture(): Fixture {
    const app = App.createConfigured__();
    app.vault.createFolderSync__('d');
    const tFile = app.vault.createSync__('d/b.md', '');
    const originalApp = app.asOriginalType__();
    const file = castTo<TFile>(originalApp.vault.getFileByPath(tFile.path));

    const explorerLeaves: WorkspaceLeaf[] = [];
    const markdownLeaves: WorkspaceLeaf[] = [];
    const virtualLeaves: WorkspaceLeaf[] = [];
    vi.spyOn(originalApp.workspace, 'getLeavesOfType').mockImplementation((viewType) => {
      switch (viewType) {
        case ViewType.FileExplorer: {
          return explorerLeaves;
        }
        case ViewType.Markdown: {
          return markdownLeaves;
        }
        case VIRTUAL_FOLDER_NOTE_VIEW_TYPE: {
          return virtualLeaves;
        }
        default: {
          return [];
        }
      }
    });

    const folderMapComponent: FolderMapStub = {
      highlightTarget: vi.fn<FolderMapComponent['highlightTarget']>(),
      refresh: vi.fn<FolderMapComponent['refresh']>(),
      show: vi.fn<FolderMapComponent['show']>(() => noopAsync())
    };
    const navigate = vi.fn<SiblingNavigator['navigate']>(() => noopAsync());
    const siblingNavigator = strictProxy<SiblingNavigator>({
      getPosition: () => ({ index: 1, length: 5 }),
      getTarget: (action) => action === NavigationAction.Previous ? null : file,
      navigate
    });

    const partialFixture = {
      app,
      explorerLeaves,
      file,
      folderMapComponent,
      markdownLeaves,
      navigate,
      virtualLeaves,
      visibility: { showBottomBar: true, showTopBar: true }
    };
    const component = new NavigatorBarComponent({
      app: originalApp,
      folderMapComponent: strictProxy<FolderMapComponent>(folderMapComponent),
      getVisibility: (): NavigatorBarVisibility => partialFixture.visibility,
      siblingNavigator
    });
    const result: Fixture = Object.assign(partialFixture, { component });
    return result;
  }
});
