import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import type { NavigatorBarVisibility } from './navigator-bar-component.ts';

import { NavigationAction } from './navigation-action.ts';
import { NavigationCommandHandler } from './navigation-command-handler.ts';
import { NavigatorBarComponent } from './navigator-bar-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { SiblingNavigator } from './sibling-navigator.ts';

/**
 * The navigation commands in the order the command palette lists them, which is the order of the
 * navigator bar.
 */
const NAVIGATION_ACTIONS: readonly NavigationAction[] = [
  NavigationAction.Up,
  NavigationAction.Home,
  NavigationAction.PageUp,
  NavigationAction.Previous,
  NavigationAction.Next,
  NavigationAction.PageDown,
  NavigationAction.End
];

export class Plugin extends PluginBase {
  protected override async onloadImpl(): Promise<void> {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.pluginSettingsComponent = pluginSettingsComponent;

    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent
        })
      })
    );

    const siblingNavigator = new SiblingNavigator({
      app: this.app,
      getPageSize: (): number => pluginSettingsComponent.settings.pageSize,
      pluginNoticeComponent: this.pluginNoticeComponent
    });

    const navigatorBarComponent = this.addChild(
      new NavigatorBarComponent({
        app: this.app,
        getVisibility: (): NavigatorBarVisibility => pluginSettingsComponent.settings,
        siblingNavigator
      })
    );
    // A changed setting shows or hides a bar, or moves Page up and Page down, so the bars follow at once.
    for (const eventName of ['loadSettings', 'saveSettings'] as const) {
      const eventRef = pluginSettingsComponent.on(eventName, () => {
        navigatorBarComponent.refresh();
      });
      this.register(() => {
        pluginSettingsComponent.offref(eventRef);
      });
    }

    // `OpenDemoVaultCommandHandler` is what makes the README's first demo-vault route real: it downloads
    // The `<plugin-id>-demo-vault.zip` attached to the GitHub release and opens it as a vault in
    // A new window. It is not registered automatically -- a demo vault without this command can only be
    // Reached by downloading the asset by hand. It hides itself on mobile, so no platform guard is needed.
    await this.commandHandlerComponent.registerCommandHandlers(() => [
      ...NAVIGATION_ACTIONS.map((action) => new NavigationCommandHandler({ action, siblingNavigator })),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
