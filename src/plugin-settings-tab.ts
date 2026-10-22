import type { SettingDefinitionItem } from 'obsidian';

import {
  asCodeBlock,
  createFragmentWithCodeBlocks
} from '@mnaoumov/obsidian-lib/html-element';
import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

import { OverscrollEdges } from './plugin-settings.ts';

const MAX_OVERSCROLL_DISTANCE_PERCENT = 100;

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
      }),
      this.settingGroupEx({
        heading: 'Scrolling past the edge',
        items: [
          this.settingEx({
            desc: 'Keep scrolling past the bottom of a note to open the next item, or past the top to open the previous one. A strip at the edge shows how far to go and what opens. A fling that reaches the edge never carries on into the next item: the pull starts only with a new scroll, and pausing or scrolling back cancels it.',
            name: 'Open by scrolling past the edge',
            render: (setting) => {
              setting.addDropdown((dropdown) => {
                dropdown.addOptions({
                  /* eslint-disable perfectionist/sort-objects -- Need to keep enum order. */
                  [OverscrollEdges.None]: 'Off',
                  [OverscrollEdges.Bottom]: 'Bottom edge only: next',
                  [OverscrollEdges.Both]: 'Both edges: previous and next'
                  /* eslint-enable perfectionist/sort-objects -- Need to keep enum order. */
                });
                this.bind({ propertyName: 'overscrollEdges', valueComponent: dropdown });
              });
            }
          }),
          this.settingEx({
            desc: 'How far to keep scrolling past the edge before the item opens, as a percentage of the height of the note on screen.',
            name: 'Pull distance',
            render: (setting) => {
              setting.addNumber((number) => {
                number.setMin(1);
                number.setMax(MAX_OVERSCROLL_DISTANCE_PERCENT);
                this.bind({ propertyName: 'overscrollDistancePercent', valueComponent: number });
              });
            }
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Folder notes',
        items: [
          this.settingEx({
            desc: createFragmentWithCodeBlocks(
              `A folder's view shows its folder note. Use the folder notes the enabled folder-notes plugins are set up for: ${asCodeBlock('Folder notes')}, ${asCodeBlock('Folder Note')}, ${asCodeBlock('Waypoint')} and ${asCodeBlock('Folder Index')}.`
            ),
            name: 'Follow folder-notes plugins',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldReadFolderNotePlugins', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: createFragmentWithCodeBlocks(`Use a note inside the folder, named after it: ${asCodeBlock('d/d.md')} for the folder ${asCodeBlock('d')}.`),
            name: 'Note inside the folder',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldUseFolderNoteInside', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: createFragmentWithCodeBlocks(`Use a note beside the folder, named after it: ${asCodeBlock('d.md')} for the folder ${asCodeBlock('d')}.`),
            name: 'Note beside the folder',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldUseFolderNoteBeside', valueComponent: toggle });
              });
            }
          })
        ]
      })
    ];
  }
}
