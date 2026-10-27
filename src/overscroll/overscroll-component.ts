import type {
  App,
  TAbstractFile,
  View,
  WorkspaceLeaf
} from 'obsidian';

import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  Component,
  MarkdownView,
  TFile
} from 'obsidian';

import type { SiblingNavigator } from '../navigation/sibling-navigator.ts';
import type {
  OverscrollAction,
  OverscrollUpdate
} from './overscroll-gesture.ts';

import { NavigationAction } from '../navigation/navigation-action.ts';
import { OverscrollEdges } from '../plugin-settings.ts';
import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from '../virtual-folder-note/virtual-folder-note-view.ts';
import {
  OverscrollGesture,
  OverscrollUpdateKind,
  PULL_PAUSE_IN_MILLISECONDS
} from './overscroll-gesture.ts';
import { OverscrollIndicator } from './overscroll-indicator.ts';

/**
 * The settings the pull reads.
 */
export interface OverscrollSettings {
  readonly overscrollDistancePercent: number;
  readonly overscrollEdges: OverscrollEdges;
}

/**
 * Which edges of a scroller it stands at, counting only the edges that pull.
 */
interface Edges {
  readonly isAtBottom: boolean;
  readonly isAtTop: boolean;
}

interface OverscrollComponentConstructorParams {
  readonly app: App;
  readonly getSettings: () => OverscrollSettings;
  readonly siblingNavigator: SiblingNavigator;
}

/**
 * A view under the pointer, with the element that scrolls its content.
 */
interface ScrollContext {
  readonly scrollerEl: HTMLElement;
  readonly view: View;
}

/**
 * How close to an edge, in pixels, counts as at it. Scroll positions are fractional on a scaled display.
 */
const EDGE_TOLERANCE_IN_PIXELS = 1;

/**
 * How many pixels a wheel line is, for a wheel that scrolls by lines.
 */
const PIXELS_PER_LINE = 16;

/**
 * How many animation frames landing at the end of an item may take: a long note grows as it renders.
 */
const MAX_SCROLL_TO_END_FRAMES = 10;

const PERCENT = 100;

/**
 * Opens the next item when a note is scrolled past its bottom, and the previous one when it is scrolled past its
 * top, guarded by a labelled pull. See {@link OverscrollGesture} for the gesture.
 *
 * It listens on the whole document, in every window, and acts on the Markdown view or virtual folder note the
 * wheel or the finger is over. Only the view's own scroller counts: a wheel over anything inside it that scrolls
 * on its own, such as a code block or an embed with a height of its own, never pulls.
 */
export class OverscrollComponent extends Component {
  private readonly app: App;
  private context: null | ScrollContext = null;
  private readonly gesture = new OverscrollGesture();
  private readonly getSettings: () => OverscrollSettings;
  private readonly indicator = new OverscrollIndicator();
  private pauseTimeoutId: null | number = null;
  private readonly siblingNavigator: SiblingNavigator;

  public constructor(params: OverscrollComponentConstructorParams) {
    super();
    this.app = params.app;
    this.getSettings = params.getSettings;
    this.siblingNavigator = params.siblingNavigator;
  }

  public override onload(): void {
    this.registerDocument(activeDocument);
    this.registerEvent(this.app.workspace.on('window-open', (_workspaceWindow, win) => {
      this.registerDocument(win.document);
    }));
    this.register(() => {
      this.clearPauseTimeout();
      this.indicator.hide();
    });
  }

  private applyUpdate(context: ScrollContext, item: null | TAbstractFile, update: OverscrollUpdate, isTouch: boolean): void {
    switch (update.kind) {
      case OverscrollUpdateKind.Commit: {
        this.indicator.hide();
        invokeAsyncSafely(() => this.open(update.action, item, context.view.leaf));
        break;
      }
      case OverscrollUpdateKind.Pull: {
        const target = this.siblingNavigator.getTarget(update.action, item);
        this.indicator.show(context.view.containerEl, {
          isTouch,
          pull: update,
          targetName: target ? getItemName(target) : null
        });
        break;
      }
      default: {
        this.indicator.hide();
        break;
      }
    }
  }

  private cancelPull(): void {
    this.gesture.cancel();
    this.indicator.hide();
  }

  private clearPauseTimeout(): void {
    if (this.pauseTimeoutId === null) {
      return;
    }
    window.clearTimeout(this.pauseTimeoutId);
    this.pauseTimeoutId = null;
  }

  private findContext(target: EventTarget | null): null | ScrollContext {
    // A wheel or touch event on a document targets a node in it.
    const node = target as Node | null;
    const { workspace } = this.app;
    for (const leaf of [...workspace.getLeavesOfType(ViewType.Markdown), ...workspace.getLeavesOfType(VIRTUAL_FOLDER_NOTE_VIEW_TYPE)]) {
      const scrollerEl = getScrollerEl(leaf.view);
      if (scrollerEl?.contains(node)) {
        return { scrollerEl, view: leaf.view };
      }
    }
    return null;
  }

  private getEdges(scrollerEl: HTMLElement): Edges {
    const { clientHeight, scrollHeight, scrollTop } = scrollerEl;
    return {
      isAtBottom: scrollTop + clientHeight >= scrollHeight - EDGE_TOLERANCE_IN_PIXELS,
      isAtTop: this.getSettings().overscrollEdges === OverscrollEdges.Both && scrollTop <= EDGE_TOLERANCE_IN_PIXELS
    };
  }

  private getThreshold(scrollerEl: HTMLElement): number {
    return scrollerEl.clientHeight * this.getSettings().overscrollDistancePercent / PERCENT;
  }

  private handleTouchEnd(): void {
    const { context } = this;
    this.context = null;
    if (!context) {
      return;
    }
    const item = this.siblingNavigator.getLeafItem(context.view.leaf);
    const update = this.gesture.touchEnd((action) => this.siblingNavigator.getTarget(action, item) !== null, this.getThreshold(context.scrollerEl));
    this.applyUpdate(context, item, update, true);
  }

  private handleTouchMove(touchEvent: TouchEvent): void {
    const { context } = this;
    const touch = touchEvent.touches[0];
    if (!context || !touch || touchEvent.touches.length > 1) {
      return;
    }
    const item = this.siblingNavigator.getLeafItem(context.view.leaf);
    const update = this.gesture.touchMove({
      ...this.getEdges(context.scrollerEl),
      hasTarget: (action) => this.siblingNavigator.getTarget(action, item) !== null,
      threshold: this.getThreshold(context.scrollerEl),
      y: touch.clientY
    });
    this.applyUpdate(context, item, update, true);
  }

  private handleTouchStart(touchEvent: TouchEvent): void {
    this.indicator.hide();
    this.context = null;
    const touch = touchEvent.touches[0];
    if (this.getSettings().overscrollEdges === OverscrollEdges.None || !touch || touchEvent.touches.length > 1) {
      return;
    }
    const context = this.findContext(touchEvent.target);
    if (!context || isInInnerScroller(touchEvent.target, context.scrollerEl)) {
      return;
    }
    this.context = context;
    this.gesture.touchStart({
      ...this.getEdges(context.scrollerEl),
      y: touch.clientY
    });
  }

  private handleWheel(wheelEvent: WheelEvent): void {
    if (this.getSettings().overscrollEdges === OverscrollEdges.None || wheelEvent.ctrlKey || Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY)) {
      return;
    }
    const context = this.findContext(wheelEvent.target);
    if (!context || isInInnerScroller(wheelEvent.target, context.scrollerEl)) {
      this.cancelPull();
      return;
    }

    const item = this.siblingNavigator.getLeafItem(context.view.leaf);
    const update = this.gesture.wheel({
      ...this.getEdges(context.scrollerEl),
      delta: getDeltaInPixels(wheelEvent, context.scrollerEl),
      hasTarget: (action) => this.siblingNavigator.getTarget(action, item) !== null,
      threshold: this.getThreshold(context.scrollerEl),
      time: Date.now()
    });
    if (update.kind === OverscrollUpdateKind.Swallow) {
      wheelEvent.preventDefault();
      return;
    }
    this.applyUpdate(context, item, update, false);

    this.clearPauseTimeout();
    if (update.kind === OverscrollUpdateKind.Pull) {
      this.pauseTimeoutId = window.setTimeout(() => {
        this.pauseTimeoutId = null;
        this.cancelPull();
      }, PULL_PAUSE_IN_MILLISECONDS);
    }
  }

  /**
   * Opens the item a pull reached. Going back lands at the end of the previous item, so reading backwards is
   * continuous.
   *
   * @param action - The pull's action.
   * @param item - The item the pull started from.
   * @param leaf - The leaf it opens in.
   */
  private async open(action: OverscrollAction, item: null | TAbstractFile, leaf: WorkspaceLeaf): Promise<void> {
    await this.siblingNavigator.navigate(action, { item, leaf });
    if (action === NavigationAction.Previous) {
      await scrollToEnd(leaf);
    }
  }

  private registerDocument(doc: Document): void {
    this.registerDomEvent(doc, 'wheel', (wheelEvent) => {
      this.handleWheel(wheelEvent);
    }, { capture: true, passive: false });
    this.registerDomEvent(doc, 'touchstart', (touchEvent) => {
      this.handleTouchStart(touchEvent);
    }, { capture: true, passive: true });
    this.registerDomEvent(doc, 'touchmove', (touchEvent) => {
      this.handleTouchMove(touchEvent);
    }, { capture: true, passive: true });
    for (const eventName of ['touchend', 'touchcancel'] as const) {
      this.registerDomEvent(doc, eventName, () => {
        this.handleTouchEnd();
      }, { capture: true, passive: true });
    }
  }
}

/**
 * Returns the element that scrolls a view's content.
 *
 * @param view - The view.
 * @returns The editor's scroller, Reading view's, or the virtual folder note's content, or `null` for any other view.
 */
export function getScrollerEl(view: View): HTMLElement | null {
  if (view instanceof MarkdownView) {
    return view.getMode() === 'preview' ? view.previewMode.renderer.previewEl : view.editMode.cm.scrollDOM;
  }
  return view instanceof VirtualFolderNoteView ? view.contentEl : null;
}

function getDeltaInPixels(wheelEvent: WheelEvent, scrollerEl: HTMLElement): number {
  switch (wheelEvent.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE: {
      return wheelEvent.deltaY * PIXELS_PER_LINE;
    }
    case WheelEvent.DOM_DELTA_PAGE: {
      return wheelEvent.deltaY * scrollerEl.clientHeight;
    }
    default: {
      return wheelEvent.deltaY;
    }
  }
}

function getItemName(item: TAbstractFile): string {
  return item instanceof TFile ? item.basename : item.name;
}

/**
 * Tells whether an event's target is inside something that scrolls vertically on its own, within the view's
 * scroller, such as a code block or an embed with a height of its own.
 *
 * @param target - The event's target.
 * @param scrollerEl - The view's scroller.
 * @returns Whether it is.
 */
function isInInnerScroller(target: EventTarget | null, scrollerEl: HTMLElement): boolean {
  // The context lookup has already found the target inside the scroller, so it is a node.
  const node = target as Node;
  for (let el = node.instanceOf(HTMLElement) ? node : node.parentElement; el && el !== scrollerEl; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight) {
      continue;
    }
    const { overflowY } = el.win.getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return true;
    }
  }
  return false;
}

/**
 * Scrolls a leaf's view to its end, and again on each animation frame until it stays there: a long note grows as
 * it renders, and opening a file restores its scroll after the leaf has it.
 *
 * @param leaf - The leaf.
 */
async function scrollToEnd(leaf: WorkspaceLeaf): Promise<void> {
  let previousScrollHeight = -1;
  for (let frame = 0; frame < MAX_SCROLL_TO_END_FRAMES; frame++) {
    const scrollerEl = getScrollerEl(leaf.view);
    if (!scrollerEl) {
      return;
    }
    const { clientHeight, scrollHeight, scrollTop } = scrollerEl;
    if (scrollHeight === previousScrollHeight && scrollTop + clientHeight >= scrollHeight - EDGE_TOLERANCE_IN_PIXELS) {
      return;
    }
    previousScrollHeight = scrollHeight;
    scrollerEl.scrollTop = scrollHeight;
    await new Promise<void>((resolve) => {
      scrollerEl.win.requestAnimationFrame(() => {
        resolve();
      });
    });
  }
}
