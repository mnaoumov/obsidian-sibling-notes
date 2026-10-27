import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import type { NavigatorBarVisibility } from './navigator-bar/navigator-bar-component.ts';
import type { OverscrollSettings } from './overscroll/overscroll-component.ts';
import type { VirtualFolderNoteViewSettings } from './virtual-folder-note/virtual-folder-note-view.ts';

import {
  FolderMapCommand,
  FolderMapCommandHandler
} from './folder-map/folder-map-command-handler.ts';
import { FolderMapComponent } from './folder-map/folder-map-component.ts';
import {
  FOLDER_MAP_VIEW_TYPE,
  FolderMapView
} from './folder-map/folder-map-view.ts';
import { NavigationAction } from './navigation/navigation-action.ts';
import { NavigationCommandHandler } from './navigation/navigation-command-handler.ts';
import { SiblingNavigator } from './navigation/sibling-navigator.ts';
import { NavigatorBarComponent } from './navigator-bar/navigator-bar-component.ts';
import { OverscrollComponent } from './overscroll/overscroll-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from './virtual-folder-note/virtual-folder-note-view.ts';

/**
 * The navigation commands in the order the command palette lists them: the order of the navigator bar,
 * then Enter, which the virtual folder note offers as a button of its own.
 */
const NAVIGATION_ACTIONS: readonly NavigationAction[] = [
  NavigationAction.Up,
  NavigationAction.Home,
  NavigationAction.PageUp,
  NavigationAction.Previous,
  NavigationAction.Next,
  NavigationAction.PageDown,
  NavigationAction.End,
  NavigationAction.Enter
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
      getPageSize: (): number => pluginSettingsComponent.settings.pageSize
    });

    const folderMapComponent = this.addChild(new FolderMapComponent({ app: this.app, siblingNavigator }));
    this.registerView(FOLDER_MAP_VIEW_TYPE, (leaf) => new FolderMapView({ folderMapComponent, leaf }));

    this.registerView(VIRTUAL_FOLDER_NOTE_VIEW_TYPE, (leaf) =>
      new VirtualFolderNoteView({
        folderMapComponent,
        getSettings: (): VirtualFolderNoteViewSettings => pluginSettingsComponent.settings,
        leaf,
        siblingNavigator
      }));

    const navigatorBarComponent = this.addChild(
      new NavigatorBarComponent({
        app: this.app,
        folderMapComponent,
        getVisibility: (): NavigatorBarVisibility => pluginSettingsComponent.settings,
        siblingNavigator
      })
    );
    this.addChild(
      new OverscrollComponent({
        app: this.app,
        getSettings: (): OverscrollSettings => pluginSettingsComponent.settings,
        siblingNavigator
      })
    );

    // A changed setting shows or hides a bar, moves Page up and Page down, or changes which note is a folder's,
    // So the bars and the virtual folder notes follow at once.
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
      new FolderMapCommandHandler({ app: this.app, command: FolderMapCommand.Show, folderMapComponent }),
      new FolderMapCommandHandler({ app: this.app, command: FolderMapCommand.Pin, folderMapComponent }),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
