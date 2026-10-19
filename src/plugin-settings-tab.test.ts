import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventMap } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { SettingGroup } from 'obsidian';

import { SettingEx } from '@mnaoumov/obsidian-lib/setting-ex';
import { AsyncEvents } from '@mnaoumov/typescript-lib/async-events';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from './plugin.ts';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

/*
 * The base's `bind` reads `setPlaceholderValue` on every value component to tell a text-based one apart.
 * The test-mocks components throw on an unmocked read, where a real one yields `undefined`, so the probe is
 * stubbed to its real result.
 */
vi.mock('@mnaoumov/obsidian-lib/setting-components/text-based-component', () => ({
  getTextBasedComponentValue: vi.fn(() => null)
}));

async function createTab(): Promise<PluginSettingsTab> {
  const dataHandler: DataHandler = {
    loadData(): Promise<unknown> {
      return Promise.resolve({});
    },
    saveData(): Promise<void> {
      return noopAsync();
    }
  };
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler,
    pluginEventSource: new AsyncEvents<PluginEventMap>()
  });
  await pluginSettingsComponent.loadWithPromises();
  const plugin = strictProxy<Plugin>({ app: App.createConfigured__().asOriginalType__() });
  return new PluginSettingsTab({ plugin, pluginSettingsComponent });
}

describe('PluginSettingsTab', () => {
  it('declares the bar toggles, the page size and the folder-note conventions, rendered as toggles and a number input', async () => {
    const tab = await createTab();
    const definitions = tab.getSettingDefinitions().flatMap((definition) => 'items' in definition ? definition.items ?? [] : [definition]);
    expect(definitions.map((definition) => 'name' in definition ? definition.name : '')).toStrictEqual([
      'Show the top bar',
      'Show the bottom bar',
      'Page size',
      'Follow folder-notes plugins',
      'Note inside the folder',
      'Note beside the folder'
    ]);

    const bindSpy = vi.spyOn(tab, 'bind');
    for (const definition of definitions) {
      if ('render' in definition) {
        definition.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
      }
    }
    expect(bindSpy.mock.calls.map(([params]) => params.propertyName)).toStrictEqual([
      'showTopBar',
      'showBottomBar',
      'pageSize',
      'shouldReadFolderNotePlugins',
      'shouldUseFolderNoteInside',
      'shouldUseFolderNoteBeside'
    ]);
    // The plugin names and the file names in the folder-note descriptions are marked as code.
    const codeCount = definitions.reduce((count, definition) => count + ('desc' in definition && definition.desc instanceof DocumentFragment ? definition.desc.querySelectorAll('code').length : 0), 0);
    expect(codeCount).toBe(8);
    expect(tab.containerEl.querySelector('input[type="number"]')).not.toBeNull();
  });
});
