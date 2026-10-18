import type { IconName } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { SiblingNavigator } from './sibling-navigator.ts';

import { NavigationAction } from './navigation-action.ts';

interface NavigationCommandDefinition {
  readonly icon: IconName;
  readonly id: string;
  readonly name: string;
}

interface NavigationCommandHandlerConstructorParams {
  readonly action: NavigationAction;
  readonly siblingNavigator: SiblingNavigator;
}

const NAVIGATION_COMMAND_DEFINITIONS: Record<NavigationAction, NavigationCommandDefinition> = {
  [NavigationAction.End]: { icon: 'chevron-last', id: 'go-to-last', name: 'Go to the last item in the folder' },
  [NavigationAction.Home]: { icon: 'chevron-first', id: 'go-to-first', name: 'Go to the first item in the folder' },
  [NavigationAction.Next]: { icon: 'chevron-right', id: 'go-to-next', name: 'Go to the next item in the folder' },
  [NavigationAction.PageDown]: { icon: 'chevrons-right', id: 'go-page-down', name: 'Go a page down in the folder' },
  [NavigationAction.PageUp]: { icon: 'chevrons-left', id: 'go-page-up', name: 'Go a page up in the folder' },
  [NavigationAction.Previous]: { icon: 'chevron-left', id: 'go-to-previous', name: 'Go to the previous item in the folder' },
  [NavigationAction.Up]: { icon: 'corner-left-up', id: 'go-up', name: 'Go up to the parent folder' }
};

/**
 * One navigation command. It is available only while its action has somewhere to go, so at either end of
 * a folder the commands that would leave it are not offered.
 */
export class NavigationCommandHandler extends GlobalCommandHandler {
  private readonly action: NavigationAction;
  private readonly siblingNavigator: SiblingNavigator;

  public constructor(params: NavigationCommandHandlerConstructorParams) {
    super(NAVIGATION_COMMAND_DEFINITIONS[params.action]);
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
