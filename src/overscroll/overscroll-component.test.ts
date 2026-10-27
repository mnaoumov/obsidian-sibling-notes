import type {
  App as AppOriginal,
  MarkdownView as MarkdownViewOriginal,
  TAbstractFile,
  TFile,
  TFolder,
  View,
  WorkspaceLeaf
} from 'obsidian';
import type { Mock } from 'vitest';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  App,
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

import type { SiblingNavigator } from '../navigation/sibling-navigator.ts';
import type { OverscrollSettings } from './overscroll-component.ts';

import { NavigationAction } from '../navigation/navigation-action.ts';
import { OverscrollEdges } from '../plugin-settings.ts';
import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from '../virtual-folder-note/virtual-folder-note-view.ts';
import {
  getScrollerEl,
  OverscrollComponent
} from './overscroll-component.ts';
import {
  NEW_GESTURE_GAP_IN_MILLISECONDS,
  PULL_PAUSE_IN_MILLISECONDS
} from './overscroll-gesture.ts';

interface Fixture {
  readonly app: AppOriginal;
  readonly component: OverscrollComponent;
  readonly files: Record<string, TFile>;
  readonly folder: TFolder;
  readonly markdownLeaves: WorkspaceLeaf[];
  readonly navigate: Mock<SiblingNavigator['navigate']>;
  settings: Mutable<OverscrollSettings>;
  targets: Partial<Record<NavigationAction, null | TAbstractFile>>;
  readonly virtualLeaves: WorkspaceLeaf[];
}

interface Metrics {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface TestMarkdownView {
  readonly editorMetrics: Metrics;
  readonly editorScrollerEl: HTMLElement;
  mode: 'preview' | 'source';
  readonly previewMetrics: Metrics;
  readonly previewScrollerEl: HTMLElement;
  readonly view: MarkdownViewOriginal;
}

const CLIENT_HEIGHT = 600;
const NOTCH = 150;
const MOMENTUM_INTERVAL_IN_MILLISECONDS = 16;
const PIXELS_PER_LINE = 16;
const PROGRESS_CSS_PROPERTY = '--sibling-notes-overscroll-progress';

/**
 * Gives an element the scroll geometry the test DOM does not lay out.
 *
 * @param el - The element.
 * @param metrics - The geometry, read live, and written by a `scrollTop` assignment.
 * @returns The geometry.
 */
function setMetrics(el: HTMLElement, metrics: Metrics): Metrics {
  Object.defineProperties(el, {
    clientHeight: { get: () => metrics.clientHeight },
    scrollHeight: { get: () => metrics.scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => metrics.scrollTop,
      set: (value: number): void => {
        metrics.scrollTop = value;
      }
    }
  });
  return metrics;
}

/**
 * Sets an element's vertical overflow inline, because the test DOM has no style sheet to give it a class from.
 *
 * @param el - The element.
 * @param overflowY - The overflow.
 */
function setOverflowY(el: HTMLElement, overflowY: string): void {
  el.setAttribute('style', `overflow-y: ${overflowY}`);
}

describe('OverscrollComponent', () => {
  let fixture: Fixture;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = createFixture();
    fixture.component.load();
  });

  afterEach(() => {
    fixture.component.unload();
    vi.useRealTimers();
  });

  function openMarkdownView(): TestMarkdownView {
    const view = MarkdownView.create2__(App.createConfigured__().workspace.getLeaf(true)).asOriginalType7__();
    activeDocument.body.append(view.containerEl);
    const editorScrollerEl = view.containerEl.createDiv({ cls: 'cm-scroller' });
    const previewScrollerEl = view.containerEl.createDiv({ cls: 'markdown-preview-view' });
    Object.assign(view.editMode, { cm: { scrollDOM: editorScrollerEl } });
    Object.assign(view.previewMode, { renderer: { previewEl: previewScrollerEl } });
    const testView: TestMarkdownView = {
      editorMetrics: setMetrics(editorScrollerEl, { clientHeight: CLIENT_HEIGHT, scrollHeight: CLIENT_HEIGHT, scrollTop: 0 }),
      editorScrollerEl,
      mode: 'source',
      previewMetrics: setMetrics(previewScrollerEl, { clientHeight: CLIENT_HEIGHT, scrollHeight: CLIENT_HEIGHT, scrollTop: 0 }),
      previewScrollerEl,
      view
    };
    vi.spyOn(view, 'getMode').mockImplementation(() => testView.mode);
    // The view's leaf shows it, as in Obsidian.
    Object.assign(view.leaf, { view });
    fixture.markdownLeaves.push(view.leaf);
    return testView;
  }

  function openVirtualView(): VirtualFolderNoteView {
    const view = castTo<VirtualFolderNoteView>(Object.create(VirtualFolderNoteView.prototype));
    const containerEl = activeDocument.body.createDiv();
    const contentEl = containerEl.createDiv();
    const leaf = castTo<WorkspaceLeaf>({ view });
    Object.assign(view, { containerEl, contentEl, leaf });
    setMetrics(contentEl, { clientHeight: CLIENT_HEIGHT, scrollHeight: CLIENT_HEIGHT, scrollTop: 0 });
    fixture.virtualLeaves.push(leaf);
    return view;
  }

  function wheel(target: EventTarget, deltaY: number, init: WheelEventInit = {}): WheelEvent {
    const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ...init });
    target.dispatchEvent(wheelEvent);
    return wheelEvent;
  }

  function touch(target: EventTarget, type: string, ...ys: number[]): void {
    const touchEvent = new Event(type, { bubbles: true });
    Object.defineProperty(touchEvent, 'touches', { value: ys.map((clientY) => ({ clientY })) });
    target.dispatchEvent(touchEvent);
  }

  function pause(milliseconds = NEW_GESTURE_GAP_IN_MILLISECONDS): void {
    vi.advanceTimersByTime(milliseconds);
  }

  function getIndicator(view: View): HTMLElement | null {
    return view.containerEl.querySelector('.sibling-notes-overscroll-indicator');
  }

  function getLabel(view: View): null | string {
    return getIndicator(view)?.querySelector('.sibling-notes-overscroll-indicator-label')?.textContent ?? null;
  }

  it('does nothing while it is off', () => {
    fixture.settings.overscrollEdges = OverscrollEdges.None;
    const { editorScrollerEl, view } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH);
    touch(editorScrollerEl, 'touchstart', CLIENT_HEIGHT);
    touch(editorScrollerEl, 'touchmove', 0);
    touch(editorScrollerEl, 'touchend');
    expect(getIndicator(view)).toBeNull();
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  it('pulls past the bottom of the editor with a labelled strip, then opens the next item at a third of the height', async () => {
    const { editorScrollerEl, view } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH);
    expect(getLabel(view)).toBe('Keep scrolling for next: c');
    expect(getIndicator(view)?.dataset['edge']).toBe('bottom');
    expect(getIndicator(view)?.style.getPropertyValue(PROGRESS_CSS_PROPERTY)).toBe('0.5');

    pause(MOMENTUM_INTERVAL_IN_MILLISECONDS);
    wheel(editorScrollerEl, NOTCH);
    expect(getIndicator(view)).toBeNull();
    await vi.runAllTimersAsync();
    expect(fixture.navigate).toHaveBeenCalledWith(NavigationAction.Next, { item: fixture.files['b'], leaf: view.leaf });
  });

  it('swallows the momentum after it opens an item', () => {
    const { editorScrollerEl } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH * 2);
    pause(MOMENTUM_INTERVAL_IN_MILLISECONDS);
    expect(wheel(editorScrollerEl, NOTCH).defaultPrevented).toBe(true);
  });

  it('pulls past the top to the previous item only when both edges pull, and lands at its end', async () => {
    const { editorMetrics, editorScrollerEl, view } = openMarkdownView();
    editorMetrics.scrollHeight = CLIENT_HEIGHT * 2;
    wheel(editorScrollerEl, -NOTCH * 2);
    expect(fixture.navigate).not.toHaveBeenCalled();

    fixture.settings.overscrollEdges = OverscrollEdges.Both;
    pause();
    wheel(editorScrollerEl, -NOTCH);
    expect(getLabel(view)).toBe('Keep scrolling for previous: a');
    expect(getIndicator(view)?.dataset['edge']).toBe('top');
    pause(MOMENTUM_INTERVAL_IN_MILLISECONDS);
    wheel(editorScrollerEl, -NOTCH);
    await vi.runAllTimersAsync();
    expect(fixture.navigate).toHaveBeenCalledWith(NavigationAction.Previous, { item: fixture.files['b'], leaf: view.leaf });
    expect(editorMetrics.scrollTop).toBe(editorMetrics.scrollHeight);
  });

  it('keeps landing at the end while the item settles, for a bounded number of frames', async () => {
    fixture.settings.overscrollEdges = OverscrollEdges.Both;
    const { editorMetrics, editorScrollerEl } = openMarkdownView();
    editorMetrics.scrollHeight = CLIENT_HEIGHT * 2;
    // The first scroll is undone, as opening a file restores its own scroll, and then the note keeps growing.
    let isFirstScroll = true;
    Object.defineProperty(editorScrollerEl, 'scrollTop', {
      get: () => editorMetrics.scrollTop,
      set: (value: number): void => {
        if (isFirstScroll) {
          isFirstScroll = false;
          return;
        }
        editorMetrics.scrollTop = value;
        editorMetrics.scrollHeight += NOTCH;
      }
    });
    wheel(editorScrollerEl, -NOTCH * 2);
    await vi.runAllTimersAsync();
    expect(editorMetrics.scrollHeight).toBe(CLIENT_HEIGHT * 2 + NOTCH * 9);
  });

  it('stops landing at the end when the leaf no longer shows a scroller', async () => {
    fixture.settings.overscrollEdges = OverscrollEdges.Both;
    const { editorScrollerEl, view } = openMarkdownView();
    fixture.navigate.mockImplementation(() => {
      Object.assign(view.leaf, { view: {} });
      return noopAsync();
    });
    wheel(editorScrollerEl, -NOTCH * 2);
    await vi.runAllTimersAsync();
    expect(fixture.navigate).toHaveBeenCalledTimes(1);
  });

  it('pulls in Reading view, by lines and by pages too', () => {
    const testView = openMarkdownView();
    testView.mode = 'preview';
    wheel(testView.previewScrollerEl, 1, { deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(getIndicator(testView.view)?.style.getPropertyValue(PROGRESS_CSS_PROPERTY)).toBe(String(PIXELS_PER_LINE / (CLIENT_HEIGHT / 2)));
    pause(MOMENTUM_INTERVAL_IN_MILLISECONDS);
    wheel(testView.previewScrollerEl, 1, { deltaMode: WheelEvent.DOM_DELTA_PAGE });
    expect(fixture.navigate).toHaveBeenCalledTimes(1);
    // The editor's scroller is not the one shown.
    pause();
    wheel(testView.editorScrollerEl, NOTCH);
    expect(getIndicator(testView.view)).toBeNull();
  });

  it('pulls in a virtual folder note, naming a folder target by its name', () => {
    const view = openVirtualView();
    fixture.targets[NavigationAction.Next] = fixture.folder;
    wheel(view.contentEl, NOTCH);
    expect(getLabel(view)).toBe('Keep scrolling for next: d');
  });

  it('cancels the pull after a pause, and on a scroll anywhere else', () => {
    const { editorScrollerEl, view } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH);
    pause(PULL_PAUSE_IN_MILLISECONDS);
    expect(getIndicator(view)).toBeNull();

    pause();
    wheel(editorScrollerEl, NOTCH);
    wheel(activeDocument.body, NOTCH);
    expect(getIndicator(view)).toBeNull();
  });

  it('ignores zooming, sideways scrolling and other views', () => {
    fixture.markdownLeaves.push(castTo<WorkspaceLeaf>({ view: {} }));
    const { editorScrollerEl, view } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH, { ctrlKey: true });
    wheel(editorScrollerEl, NOTCH, { deltaX: NOTCH * 2 });
    expect(getIndicator(view)).toBeNull();
    wheel(editorScrollerEl, NOTCH);
    expect(getIndicator(view)).not.toBeNull();
  });

  it('says there is nothing further at the last item', () => {
    fixture.targets[NavigationAction.Next] = null;
    const { editorScrollerEl, view } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH * 3);
    expect(getLabel(view)).toBe('This is the last item in the folder');
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  it('never pulls over something inside the note that scrolls on its own', () => {
    const { editorScrollerEl, view } = openMarkdownView();
    for (const overflowY of ['auto', 'scroll']) {
      const innerEl = editorScrollerEl.createDiv();
      setOverflowY(innerEl, overflowY);
      setMetrics(innerEl, { clientHeight: NOTCH, scrollHeight: NOTCH * 2, scrollTop: 0 });
      wheel(innerEl.createSpan(), NOTCH);
      touch(innerEl, 'touchstart', CLIENT_HEIGHT);
      touch(innerEl, 'touchmove', 0);
      expect(getIndicator(view)).toBeNull();
    }

    // Something taller than its box that does not scroll, and plain text, pull as the note does.
    const clippedEl = editorScrollerEl.createDiv();
    setOverflowY(clippedEl, 'hidden');
    setMetrics(clippedEl, { clientHeight: NOTCH, scrollHeight: NOTCH * 2, scrollTop: 0 });
    const textNode = activeDocument.createTextNode('text');
    clippedEl.createDiv().append(textNode);
    pause();
    wheel(textNode, NOTCH);
    expect(getIndicator(view)).not.toBeNull();
  });

  it('pulls with a touch that lands at the edge, and opens on release past the threshold', async () => {
    const { editorScrollerEl, view } = openMarkdownView();
    touch(editorScrollerEl, 'touchstart', CLIENT_HEIGHT);
    touch(editorScrollerEl, 'touchmove', CLIENT_HEIGHT - NOTCH);
    expect(getLabel(view)).toBe('Keep pulling for next: c');
    touch(editorScrollerEl, 'touchmove', 0);
    expect(getLabel(view)).toBe('Release to open next: c');
    touch(editorScrollerEl, 'touchend');
    expect(getIndicator(view)).toBeNull();
    await vi.runAllTimersAsync();
    expect(fixture.navigate).toHaveBeenCalledWith(NavigationAction.Next, { item: fixture.files['b'], leaf: view.leaf });
  });

  it('cancels a touch released short of the threshold, and ignores other touches', () => {
    const { editorScrollerEl, view } = openMarkdownView();
    touch(editorScrollerEl, 'touchstart', CLIENT_HEIGHT);
    touch(editorScrollerEl, 'touchmove', CLIENT_HEIGHT - NOTCH);
    touch(editorScrollerEl, 'touchmove', CLIENT_HEIGHT - NOTCH, 0);
    touch(editorScrollerEl, 'touchmove');
    touch(editorScrollerEl, 'touchcancel');
    expect(getIndicator(view)).toBeNull();

    touch(editorScrollerEl, 'touchstart', CLIENT_HEIGHT, 0);
    touch(editorScrollerEl, 'touchmove', 0);
    touch(editorScrollerEl, 'touchstart');
    touch(activeDocument.body, 'touchstart', CLIENT_HEIGHT);
    touch(editorScrollerEl, 'touchmove', 0);
    touch(editorScrollerEl, 'touchend');
    expect(getIndicator(view)).toBeNull();
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  it('listens in every window it opens, and leaves nothing behind when unloaded', () => {
    const registerDomEventSpy = vi.spyOn(fixture.component, 'registerDomEvent');
    const otherWindowDocument = activeDocument.implementation.createHTMLDocument();
    fixture.app.workspace.trigger('window-open', {}, { document: otherWindowDocument });
    expect(registerDomEventSpy.mock.calls.map(([target]) => target)).toContain(otherWindowDocument);

    const { editorScrollerEl, view } = openMarkdownView();
    wheel(editorScrollerEl, NOTCH);
    fixture.component.unload();
    expect(getIndicator(view)).toBeNull();
  });

  it('finds no scroller in any other view', () => {
    expect(getScrollerEl(castTo<View>({}))).toBeNull();
  });

  function createFixture(): Fixture {
    const app = App.createConfigured__();
    app.vault.createFolderSync__('d');
    for (const name of ['a', 'b', 'c']) {
      app.vault.createSync__(`d/${name}.md`, '');
    }
    const originalApp = app.asOriginalType__();
    const files: Record<string, TFile> = {};
    for (const name of ['a', 'b', 'c']) {
      files[name] = castTo<TFile>(originalApp.vault.getFileByPath(`d/${name}.md`));
    }
    const folder = castTo<TFolder>(originalApp.vault.getFolderByPath('d'));

    const markdownLeaves: WorkspaceLeaf[] = [];
    const virtualLeaves: WorkspaceLeaf[] = [];
    vi.spyOn(originalApp.workspace, 'getLeavesOfType').mockImplementation((viewType) => {
      switch (viewType) {
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

    const navigate = vi.fn<SiblingNavigator['navigate']>(() => noopAsync());
    const partialFixture = {
      app: originalApp,
      files,
      folder,
      markdownLeaves,
      navigate,
      settings: { overscrollDistancePercent: 50, overscrollEdges: OverscrollEdges.Bottom },
      targets: { [NavigationAction.Next]: files['c'], [NavigationAction.Previous]: files['a'] } as Fixture['targets'],
      virtualLeaves
    };
    const siblingNavigator = strictProxy<SiblingNavigator>({
      getLeafItem: () => files['b'] ?? null,
      getTarget: (action) => partialFixture.targets[action] ?? null,
      navigate
    });
    const component = new OverscrollComponent({
      app: originalApp,
      getSettings: (): OverscrollSettings => partialFixture.settings,
      siblingNavigator
    });
    return Object.assign(partialFixture, { component });
  }
});
