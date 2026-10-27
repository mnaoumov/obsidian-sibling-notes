import type { IconName } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { SiblingNavigator } from './sibling-navigator.ts';

import { NavigationAction } from './navigation-action.ts';

/**
 * How an action is presented: as a command, and as a navigator bar button.
 */
export interface NavigationActionDefinition {
  /**
   * The icon of the command and the button.
   */
  readonly icon: IconName;

  /**
   * The command id, without the plugin id.
   */
  readonly id: string;

  /**
   * The button's tooltip.
   */
  readonly label: string;

  /**
   * The command name.
   */
  readonly name: string;
}

interface NavigationCommandHandlerConstructorParams {
  readonly action: NavigationAction;
  readonly siblingNavigator: SiblingNavigator;
}

/**
 * How each action is presented.
 */
export const NAVIGATION_ACTION_DEFINITIONS: Readonly<Record<NavigationAction, NavigationActionDefinition>> = {
  [NavigationAction.End]: { icon: 'chevron-last', id: 'go-to-last', label: 'Last item', name: 'Go to the last item in the folder' },
  [NavigationAction.Enter]: { icon: 'corner-right-down', id: 'enter-folder', label: 'Enter', name: 'Go into the folder, to its first item' },
  [NavigationAction.Home]: { icon: 'chevron-first', id: 'go-to-first', label: 'First item', name: 'Go to the first item in the folder' },
  [NavigationAction.Next]: { icon: 'chevron-right', id: 'go-to-next', label: 'Next item', name: 'Go to the next item in the folder' },
  [NavigationAction.PageDown]: { icon: 'chevrons-right', id: 'go-page-down', label: 'A page down', name: 'Go a page down in the folder' },
  [NavigationAction.PageUp]: { icon: 'chevrons-left', id: 'go-page-up', label: 'A page up', name: 'Go a page up in the folder' },
  [NavigationAction.Previous]: { icon: 'chevron-left', id: 'go-to-previous', label: 'Previous item', name: 'Go to the previous item in the folder' },
  [NavigationAction.Up]: { icon: 'folder-up', id: 'go-up', label: 'Up to the parent folder', name: 'Go up to the parent folder' }
};

/**
 * One navigation command. It is available only while its action has somewhere to go, so at either end of
 * a folder the commands that would leave it are not offered.
 */
export class NavigationCommandHandler extends GlobalCommandHandler {
  private readonly action: NavigationAction;
  private readonly siblingNavigator: SiblingNavigator;

  public constructor(params: NavigationCommandHandlerConstructorParams) {
    const { icon, id, name } = NAVIGATION_ACTION_DEFINITIONS[params.action];
    super({ icon, id, name });
    this.action = params.action;
    this.siblingNavigator = params.siblingNavigator;
  }

  protected override canExecute(): boolean {
    return this.siblingNavigator.getTarget(this.action) !== null;
  }

  protected override async execute(): Promise<void> {
    await this.siblingNavigator.navigate(this.action);
  }
}
