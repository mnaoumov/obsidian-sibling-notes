import type { SettingDefinitionItem } from 'obsidian';

import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

/**
 * The settings tab is declarative: return one definition per row from `getSettingDefinitionItems()` and
 * Obsidian renders them. `bind` wires a component to a settings property in both directions, so there is
 * no read/write plumbing to maintain.
 */
export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingEx({
        desc: 'Show the navigator bar above the note, after the inline title and the properties.',
        name: 'Show the top bar',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'showTopBar', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: 'Show the navigator bar below the note, before the embedded backlinks.',
        name: 'Show the bottom bar',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'showBottomBar', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: 'How many items Page up and Page down move through the folder. They stop at the first and the last item.',
        name: 'Page size',
        render: (setting) => {
          setting.addNumber((number) => {
            number.setMin(1);
            this.bind({ propertyName: 'pageSize', valueComponent: number });
          });
        }
      })
    ];
  }
}
