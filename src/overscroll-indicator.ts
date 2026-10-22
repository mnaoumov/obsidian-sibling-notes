import type { OverscrollPull } from './overscroll-gesture.ts';

import { NavigationAction } from './navigation-action.ts';

/**
 * The CSS classes of the strip. They are the plugin's public styling surface, so a theme or a snippet can restyle
 * the strip.
 */
export enum OverscrollIndicatorCssClass {
  Fill = 'sibling-notes-overscroll-indicator-fill',
  Host = 'sibling-notes-overscroll-host',
  Indicator = 'sibling-notes-overscroll-indicator',
  Label = 'sibling-notes-overscroll-indicator-label'
}

/**
 * What the strip shows besides the pull itself.
 */
export interface OverscrollIndicatorState {
  /**
   * Whether the pull is a touch, which opens on release, or a wheel, which opens as soon as it is long enough.
   */
  readonly isTouch: boolean;
  readonly pull: OverscrollPull;

  /**
   * The name of the item the pull would open, or `null` when there is none.
   */
  readonly targetName: null | string;
}

/**
 * The CSS property the fill's width is read from, from `0` to `1`.
 */
const PROGRESS_CSS_PROPERTY = '--sibling-notes-overscroll-progress';

/**
 * The labelled strip at a note's edge that shows a pull past it: how far it has gone, and what it opens.
 */
export class OverscrollIndicator {
  /**
   * The strip's element.
   */
  public readonly el: HTMLElement;

  private hostEl: HTMLElement | null = null;
  private readonly labelEl: HTMLElement;

  public constructor() {
    this.el = createDiv({ cls: OverscrollIndicatorCssClass.Indicator });
    // The fill's width follows the progress property, so nothing else ever touches it.
    this.el.createDiv({ cls: OverscrollIndicatorCssClass.Fill });
    this.labelEl = this.el.createDiv({ cls: OverscrollIndicatorCssClass.Label });
  }

  /**
   * Takes the strip out.
   */
  public hide(): void {
    this.el.detach();
    this.hostEl?.removeClass(OverscrollIndicatorCssClass.Host);
    this.hostEl = null;
  }

  /**
   * Shows a pull at the edge of a view.
   *
   * @param hostEl - The view's element the strip is placed in. It does not scroll, so the strip stays at its edge.
   * @param state - The pull and what it would open.
   */
  public show(hostEl: HTMLElement, state: OverscrollIndicatorState): void {
    if (this.hostEl !== hostEl) {
      this.hide();
      this.hostEl = hostEl;
      hostEl.addClass(OverscrollIndicatorCssClass.Host);
      hostEl.append(this.el);
    }
    const { pull } = state;
    this.el.dataset['edge'] = pull.action === NavigationAction.Next ? 'bottom' : 'top';
    this.el.toggleClass('is-ready', pull.isReady);
    this.el.toggleClass('has-no-target', !pull.hasTarget);
    this.el.setCssProps({ [PROGRESS_CSS_PROPERTY]: String(pull.hasTarget ? pull.progress : 0) });
    this.labelEl.setText(getLabel(state));
  }
}

function getLabel(state: OverscrollIndicatorState): string {
  const { isTouch, pull, targetName } = state;
  const direction = pull.action === NavigationAction.Next ? 'next' : 'previous';
  if (targetName === null) {
    return `This is the ${pull.action === NavigationAction.Next ? 'last' : 'first'} item in the folder`;
  }
  if (pull.isReady) {
    return `Release to open ${direction}: ${targetName}`;
  }
  return `${isTouch ? 'Keep pulling' : 'Keep scrolling'} for ${direction}: ${targetName}`;
}
