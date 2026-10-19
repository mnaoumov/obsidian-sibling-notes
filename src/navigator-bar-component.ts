import type {
  ReadViewRenderer,
  RendererSection
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  MarkdownEditView
} from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  Component,
  debounce,
  MarkdownView
} from 'obsidian';

import type { NavigationAction } from './navigation-action.ts';
import type { SiblingNavigator } from './sibling-navigator.ts';

import { getFileExplorerView } from './folder-sequence.ts';
import {
  NavigatorBar,
  NavigatorBarPlacement
} from './navigator-bar.ts';

/**
 * Which bars show.
 */
export interface NavigatorBarVisibility {
  readonly showBottomBar: boolean;
  readonly showTopBar: boolean;
}

interface NavigatorBarComponentConstructorParams {
  readonly app: App;
  readonly getVisibility: () => NavigatorBarVisibility;
  readonly siblingNavigator: SiblingNavigator;
}

// TODO: Read these straight off `ReadViewRenderer` once `obsidian-typings` declares them. Checked live on
// Obsidian 1.14.4: `header` and `footer` are the `.mod-header` and `.mod-footer` sections, and each update
// method resets its section's measured height and queues a render.
interface ReadViewRendererWithHeaderAndFooter extends ReadViewRenderer {
  footer: null | RendererSection;
  header: null | RendererSection;
  updateFooter: () => void;
  updateHeader: () => void;
}

interface ViewBars {
  readonly bottom: NavigatorBar;
  readonly top: NavigatorBar;
}

const REFRESH_DELAY_IN_MILLISECONDS = 50;

/**
 * The space below the bottom bar in the editor: the scroll-past-end space the editor would otherwise put above it.
 */
const SCROLL_PAST_END_CSS_PROPERTY = '--sibling-notes-scroll-past-end';

/**
 * Puts a navigator bar above and below every open note, and keeps them current.
 *
 * Placement follows Obsidian's own inline title, properties and embedded backlinks, which a Markdown view
 * moves between its editor and its Reading view on every mode switch:
 *
 * - In the editor, the bars are children of `.cm-sizer`, right before and right after `.cm-contentContainer`.
 *   The editor puts its scroll-past-end space on the content's bottom padding, so that space is moved below
 *   the bottom bar, keeping the bar right under the last line.
 * - In Reading view, the top bar ends the renderer's header section and the bottom bar starts its footer
 *   section. Either section is re-measured after a change, because the renderer lays sections out by their
 *   measured heights.
 */
export class NavigatorBarComponent extends Component {
  private readonly app: App;
  private readonly bars = new Map<MarkdownView, ViewBars>();
  private readonly getVisibility: () => NavigatorBarVisibility;
  private isEditViewPatched = false;
  private isFileExplorerViewPatched = false;
  private readonly monkeyAroundComponent = new MonkeyAroundComponent();
  private readonly requestRefresh = debounce(() => {
    this.refresh();
  }, REFRESH_DELAY_IN_MILLISECONDS);

  private readonly siblingNavigator: SiblingNavigator;

  public constructor(params: NavigatorBarComponentConstructorParams) {
    super();
    this.app = params.app;
    this.getVisibility = params.getVisibility;
    this.siblingNavigator = params.siblingNavigator;
  }

  public override onload(): void {
    this.addChild(this.monkeyAroundComponent);

    this.monkeyAroundComponent.registerMethodPatch({
      $object: MarkdownView.prototype,
      methodName: 'setMode',
      patchHandler: async ({ fallback, originalThis }) => {
        await fallback();
        this.placeBars(originalThis);
      }
    });

    const { vault, workspace } = this.app;
    this.registerEvent(workspace.on('layout-change', this.requestRefresh));
    this.registerEvent(workspace.on('file-open', this.requestRefresh));
    this.registerEvent(workspace.on('active-leaf-change', this.requestRefresh));
    this.registerEvent(vault.on('create', this.requestRefresh));
    this.registerEvent(vault.on('delete', this.requestRefresh));
    this.registerEvent(vault.on('rename', this.requestRefresh));
    this.register(this.siblingNavigator.onCurrentItemChange(this.requestRefresh));
    this.register(() => {
      this.requestRefresh.cancel();
    });

    workspace.onLayoutReady(() => {
      this.refresh();
    });
  }

  public override onunload(): void {
    for (const view of this.bars.keys()) {
      this.removeBars(view);
    }
  }

  /**
   * Adds, places and updates the bars of every open note, and drops the bars of notes that are gone.
   */
  public refresh(): void {
    const views = new Set<MarkdownView>();
    for (const leaf of this.app.workspace.getLeavesOfType(ViewType.Markdown)) {
      if (leaf.view instanceof MarkdownView) {
        views.add(leaf.view);
      }
    }

    for (const view of this.bars.keys()) {
      if (!views.has(view)) {
        this.removeBars(view);
      }
    }

    this.patchFileExplorerView();

    for (const view of views) {
      this.patchEditView(view.editMode);
      this.getOrCreateBars(view);
      this.placeBars(view);
      this.updateBars(view);
    }
  }

  private getOrCreateBars(view: MarkdownView): ViewBars {
    let viewBars = this.bars.get(view);
    if (!viewBars) {
      const siblingNavigator = this.siblingNavigator;
      function onAction(action: NavigationAction): void {
        invokeAsyncSafely(() => siblingNavigator.navigate(action, { file: view.file, leaf: view.leaf }));
      }
      viewBars = {
        bottom: new NavigatorBar({ onAction, placement: NavigatorBarPlacement.Bottom }),
        top: new NavigatorBar({ onAction, placement: NavigatorBarPlacement.Top })
      };
      this.bars.set(view, viewBars);
    }
    return viewBars;
  }

  /**
   * Moves the editor's scroll-past-end space from the content's bottom padding to below the bottom bar.
   * Without it the bar would sit half a pane below the last line.
   *
   * @param editView - The editor, right after it set its bottom padding.
   */
  private moveBottomPadding(editView: MarkdownEditView): void {
    const bottomEl = this.bars.get(editView.view)?.bottom.el;
    if (bottomEl?.parentElement !== editView.sizerEl) {
      return;
    }
    const contentEl = editView.cm.contentDOM;
    bottomEl.setCssProps({ [SCROLL_PAST_END_CSS_PROPERTY]: contentEl.style.paddingBottom });
    contentEl.setCssStyles({ paddingBottom: '0px' });
  }

  private patchEditView(editView: MarkdownEditView): void {
    if (this.isEditViewPatched) {
      return;
    }
    this.isEditViewPatched = true;
    // The editor's class is not exported, so its prototype is reached through an instance.
    const editViewPrototype = Object.getPrototypeOf(editView) as MarkdownEditView;
    this.monkeyAroundComponent.registerMethodPatch({
      $object: editViewPrototype,
      methodName: 'updateBottomPadding',
      patchHandler: ({ fallback, originalThis }) => {
        fallback();
        this.moveBottomPadding(originalThis);
      }
    });
  }

  /**
   * Refreshes the bars whenever the File explorer re-sorts: after a change of sort order, and after a
   * custom-sort plugin asks for a sort.
   */
  private patchFileExplorerView(): void {
    if (this.isFileExplorerViewPatched) {
      return;
    }
    const fileExplorerView = getFileExplorerView(this.app);
    if (!fileExplorerView) {
      return;
    }
    this.isFileExplorerViewPatched = true;
    // The File explorer's class is not exported, so its prototype is reached through its view.
    const fileExplorerViewPrototype = Object.getPrototypeOf(fileExplorerView) as typeof fileExplorerView;
    this.monkeyAroundComponent.registerMethodPatch({
      $object: fileExplorerViewPrototype,
      methodName: 'sort',
      patchHandler: ({ fallback }) => {
        fallback();
        this.requestRefresh();
      }
    });
  }

  private placeBars(view: MarkdownView): void {
    const viewBars = this.bars.get(view);
    if (!viewBars) {
      return;
    }
    const { bottom, top } = viewBars;
    const { showBottomBar, showTopBar } = this.getVisibility();

    if (view.getMode() === 'preview') {
      const renderer = view.previewMode.renderer as ReadViewRendererWithHeaderAndFooter;
      const headerEl = renderer.header?.el;
      const footerEl = renderer.footer?.el;
      bottom.el.setCssProps({ [SCROLL_PAST_END_CSS_PROPERTY]: '' });
      if (
        headerEl && this.placeOrRemove(top.el, showTopBar, headerEl.lastElementChild === top.el, () => {
          headerEl.append(top.el);
        })
      ) {
        renderer.updateHeader();
      }
      if (
        footerEl && this.placeOrRemove(bottom.el, showBottomBar, footerEl.firstElementChild === bottom.el, () => {
          footerEl.prepend(bottom.el);
        })
      ) {
        renderer.updateFooter();
      }
      return;
    }

    const editView = view.editMode;
    const contentContainerEl = editView.cm.contentDOM.parentElement;
    if (!contentContainerEl) {
      return;
    }
    const isTopChanged = this.placeOrRemove(top.el, showTopBar, contentContainerEl.previousElementSibling === top.el, () => {
      contentContainerEl.before(top.el);
    });
    const isBottomChanged = this.placeOrRemove(bottom.el, showBottomBar, contentContainerEl.nextElementSibling === bottom.el, () => {
      contentContainerEl.after(bottom.el);
    });
    if (isTopChanged || isBottomChanged) {
      // Re-runs `updateBottomPadding`, which puts the scroll-past-end space back where it belongs.
      editView.onResize();
    }
  }

  /**
   * Puts a bar where it belongs, or takes it out when it is hidden.
   *
   * @param el - The bar's element.
   * @param isShown - Whether the bar shows.
   * @param isInPlace - Whether the bar is already where it belongs.
   * @param place - Puts the bar where it belongs.
   * @returns Whether the element moved, so the container it is in or left must be re-measured.
   */
  private placeOrRemove(el: HTMLElement, isShown: boolean, isInPlace: boolean, place: () => void): boolean {
    if (!isShown) {
      if (!el.parentElement) {
        return false;
      }
      el.detach();
      el.setCssProps({ [SCROLL_PAST_END_CSS_PROPERTY]: '' });
      return true;
    }
    if (isInPlace) {
      return false;
    }
    place();
    return true;
  }

  private removeBars(view: MarkdownView): void {
    const viewBars = this.bars.get(view);
    if (!viewBars) {
      return;
    }
    this.bars.delete(view);
    const wasInEditor = viewBars.top.el.parentElement === view.editMode.sizerEl || viewBars.bottom.el.parentElement === view.editMode.sizerEl;
    viewBars.top.el.detach();
    viewBars.bottom.el.detach();
    if (wasInEditor) {
      view.editMode.onResize();
    } else {
      const renderer = view.previewMode.renderer as ReadViewRendererWithHeaderAndFooter;
      renderer.updateHeader();
      renderer.updateFooter();
    }
  }

  private updateBars(view: MarkdownView): void {
    const viewBars = this.bars.get(view);
    if (!viewBars) {
      return;
    }
    const { file } = view;
    const state = {
      isAvailable: (action: NavigationAction): boolean => this.siblingNavigator.getTarget(action, file) !== null,
      position: this.siblingNavigator.getPosition(file)
    };
    viewBars.top.update(state);
    viewBars.bottom.update(state);
  }
}
