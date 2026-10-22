import {
  setIcon,
  setTooltip
} from 'obsidian';

import type { SequencePosition } from './sibling-navigator.ts';

import { NavigationAction } from './navigation-action.ts';
import { NAVIGATION_ACTION_DEFINITIONS } from './navigation-command-handler.ts';

/**
 * Which edge of the note a bar sits on.
 */
export enum NavigatorBarPlacement {
  Bottom = 'bottom',
  Top = 'top'
}

/**
 * What a bar shows.
 */
export interface NavigatorBarState {
  /**
   * Whether an action has somewhere to go. A button whose action has not is disabled.
   */
  readonly isAvailable: (action: NavigationAction) => boolean;

  /**
   * The current item's place in its folder, or `null` when it has none.
   */
  readonly position: null | SequencePosition;
}

interface NavigatorBarConstructorParams {
  readonly onAction: (action: NavigationAction) => void;

  /**
   * Called when a button is hovered or focused, with its action, and with `null` when it is left.
   */
  readonly onHover: (action: NavigationAction | null) => void;

  /**
   * Called when the Map button is clicked, with the button.
   */
  readonly onMap: (mapButton: HTMLElement) => void;
  readonly placement: NavigatorBarPlacement;
}

/**
 * The buttons left of the position, in bar order.
 */
const LEADING_ACTIONS: readonly NavigationAction[] = [
  NavigationAction.Up,
  NavigationAction.Home,
  NavigationAction.PageUp,
  NavigationAction.Previous
];

/**
 * The buttons right of the position, in bar order.
 */
const TRAILING_ACTIONS: readonly NavigationAction[] = [
  NavigationAction.Next,
  NavigationAction.PageDown,
  NavigationAction.End
];

/**
 * The bar's action buttons, in bar order.
 */
export const NAVIGATOR_BAR_ACTIONS: readonly NavigationAction[] = [...LEADING_ACTIONS, ...TRAILING_ACTIONS];

/**
 * The `data-action` of the Map button.
 */
export const MAP_BUTTON_ACTION = 'map';

/**
 * The CSS classes of the bar. They are the plugin's public styling surface, so a theme or a snippet can
 * restyle the bar.
 */
export enum NavigatorBarCssClass {
  Bar = 'sibling-notes-navigator-bar',
  Button = 'sibling-notes-navigator-bar-button',
  Position = 'sibling-notes-navigator-bar-position'
}

/**
 * One navigator bar: Up, Home, Page up, Previous, the position, Next, Page down, End and Map.
 *
 * It owns only its element. Where the element goes, and when it is updated, is the caller's business.
 */
export class NavigatorBar {
  /**
   * The bar's element.
   */
  public readonly el: HTMLElement;

  private readonly buttons = new Map<NavigationAction, HTMLButtonElement>();
  private readonly positionEl: HTMLElement;

  public constructor(params: NavigatorBarConstructorParams) {
    this.el = createDiv({
      attr: { 'data-placement': params.placement },
      cls: NavigatorBarCssClass.Bar
    });

    for (const action of LEADING_ACTIONS) {
      this.createActionButton(action, params.onAction, params.onHover);
    }
    this.positionEl = this.el.createSpan({ cls: NavigatorBarCssClass.Position });
    for (const action of TRAILING_ACTIONS) {
      this.createActionButton(action, params.onAction, params.onHover);
    }

    const mapButton = this.createButton('Folder map');
    mapButton.dataset['action'] = MAP_BUTTON_ACTION;
    setIcon(mapButton, 'map');
    mapButton.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault();
      params.onMap(mapButton);
    });
  }

  /**
   * Shows the current state: which buttons are enabled, and the position.
   *
   * @param state - The state.
   */
  public update(state: NavigatorBarState): void {
    for (const [action, button] of this.buttons) {
      button.disabled = !state.isAvailable(action);
    }
    this.positionEl.setText(state.position ? `${String(state.position.index + 1)} / ${String(state.position.length)}` : '');
  }

  private createActionButton(action: NavigationAction, onAction: (action: NavigationAction) => void, onHover: (action: NavigationAction | null) => void): void {
    const definition = NAVIGATION_ACTION_DEFINITIONS[action];
    const button = this.createButton(definition.label);
    button.dataset['action'] = action;
    setIcon(button, definition.icon);
    button.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault();
      if (!button.disabled) {
        onAction(action);
      }
    });
    for (const eventName of ['mouseenter', 'focus'] as const) {
      button.addEventListener(eventName, () => {
        onHover(action);
      });
    }
    for (const eventName of ['mouseleave', 'blur'] as const) {
      button.addEventListener(eventName, () => {
        onHover(null);
      });
    }
    this.buttons.set(action, button);
  }

  private createButton(label: string): HTMLButtonElement {
    const button = this.el.createEl('button', {
      attr: { 'aria-label': label, 'type': 'button' },
      cls: ['clickable-icon', NavigatorBarCssClass.Button]
    });
    setTooltip(button, label);
    return button;
  }
}
