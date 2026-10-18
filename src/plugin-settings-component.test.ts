import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventMap } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettingsComponent', () => {
  it('takes its defaults from the PluginSettings class', async () => {
    const component = createComponent(undefined);
    await component.loadWithPromises();
    expect(component.settings).toBeInstanceOf(PluginSettings);
  });

  // This drives the component through the lifecycle Obsidian does: `load()` reads `data.json`, and a
  // Value the user saved there has to win over the class default.
  it('loads a saved setting from data.json over its default', async () => {
    const component = createComponent({ pageSize: 25 });
    await component.loadWithPromises();
    expect(component.settings.pageSize).toBe(25);
  });
});

function createComponent(data: unknown): PluginSettingsComponent {
  const dataHandler: DataHandler = {
    loadData(): Promise<unknown> {
      return Promise.resolve(data);
    },
    saveData(): Promise<void> {
      return noopAsync();
    }
  };

  return new PluginSettingsComponent({
    dataHandler,
    pluginEventSource: new AsyncEvents<PluginEventMap>()
  });
}
