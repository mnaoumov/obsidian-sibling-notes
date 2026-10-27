import type {
  App as AppOriginal,
  PluginManifest,
  View
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { Plugin as ObsidianPlugin } from 'obsidian';
import {
  App,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { SiblingNavigator } from './navigation/sibling-navigator.ts';
import type { NavigatorBarVisibility } from './navigator-bar/navigator-bar-component.ts';
import type { OverscrollSettings } from './overscroll/overscroll-component.ts';
import type { VirtualFolderNoteViewSettings } from './virtual-folder-note/virtual-folder-note-view.ts';

import {
  FOLDER_MAP_VIEW_TYPE,
  FolderMapView
} from './folder-map/folder-map-view.ts';
import { NavigatorBarComponent } from './navigator-bar/navigator-bar-component.ts';
import { OverscrollComponent } from './overscroll/overscroll-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { OverscrollEdges } from './plugin-settings.ts';
import { Plugin } from './plugin.ts';
import {
  VIRTUAL_FOLDER_NOTE_VIEW_TYPE,
  VirtualFolderNoteView
} from './virtual-folder-note/virtual-folder-note-view.ts';

interface AppGlobal {
  app: AppOriginal;
}

interface NavigatorBarComponentInternals {
  readonly getVisibility: () => NavigatorBarVisibility;
}

interface OverscrollComponentInternals {
  readonly getSettings: () => OverscrollSettings;
}

interface PluginWithSettings {
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface SiblingNavigatorInternals {
  readonly getPageSize: () => number;
}

interface VirtualFolderNoteViewInternals {
  readonly getSettings: () => VirtualFolderNoteViewSettings;
  readonly siblingNavigator: SiblingNavigator;
}

const manifest = castTo<PluginManifest>({
  author: 'test',
  description: 'test',
  id: 'sibling-notes',
  minAppVersion: '1.0.0',
  name: 'Sibling Notes',
  version: '1.0.0'
});

let mockApp: App;
let app: AppOriginal;

function createView(type: string): View {
  const viewCreator = ensureNonNullable(mockApp.viewRegistry.getViewCreatorByType(type));
  return viewCreator(WorkspaceLeaf.create2__(mockApp).asOriginalType3__());
}

function getSettingsComponent(plugin: Plugin): PluginSettingsComponent {
  return castTo<PluginWithSettings>(plugin).pluginSettingsComponent;
}

describe('Plugin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockApp = App.createConfigured__();
    app = mockApp.asOriginalType__();
    // Expose the app as the global instance so library helpers that resolve the app without an explicit argument read this one.
    castTo<AppGlobal>(window).app = app;
  });

  it('extends the Obsidian Plugin class', () => {
    expect(Plugin.prototype).toBeInstanceOf(ObsidianPlugin);
  });

  it('registers the navigation commands, the folder map commands and the open demo vault command', async () => {
    const plugin = new Plugin(app, manifest);
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');
    await plugin.onload();
    const ids = addCommandSpy.mock.calls.map(([command]) => command.id);
    // The plugin's own commands follow the ones its base class adds, in the order of the navigator bar.
    expect(ids.slice(ids.indexOf('go-up'))).toStrictEqual([
      'go-up',
      'go-to-first',
      'go-page-up',
      'go-to-previous',
      'go-to-next',
      'go-page-down',
      'go-to-last',
      'enter-folder',
      'show-folder-map',
      'pin-folder-map',
      'open-demo-vault'
    ]);
  });

  it('registers the pinned folder map view', async () => {
    const plugin = new Plugin(app, manifest);
    await plugin.onload();
    expect(createView(FOLDER_MAP_VIEW_TYPE)).toBeInstanceOf(FolderMapView);
  });

  it('registers the virtual folder note view, which reads the current settings and pages by the current page size', async () => {
    const plugin = new Plugin(app, manifest);
    await plugin.onload();
    const view = createView(VIRTUAL_FOLDER_NOTE_VIEW_TYPE);
    expect(view).toBeInstanceOf(VirtualFolderNoteView);

    const internals = castTo<VirtualFolderNoteViewInternals>(view);
    const settingsComponent = getSettingsComponent(plugin);
    expect(internals.getSettings()).toBe(settingsComponent.settings);
    const siblingNavigator = castTo<SiblingNavigatorInternals>(internals.siblingNavigator);
    expect(siblingNavigator.getPageSize()).toBe(settingsComponent.settings.pageSize);

    await settingsComponent.editAndSave((settings) => {
      settings.pageSize = 3;
    });
    expect(siblingNavigator.getPageSize()).toBe(3);
    expect(internals.getSettings()).toBe(settingsComponent.settings);
  });

  it('shows or hides the navigator bars by the current settings', async () => {
    const plugin = new Plugin(app, manifest);
    const addChildSpy = vi.spyOn(plugin, 'addChild');
    await plugin.onload();
    const navigatorBarComponent = addChildSpy.mock.results.map((result) => result.value as unknown).find((child) => child instanceof NavigatorBarComponent);
    const settingsComponent = getSettingsComponent(plugin);
    await settingsComponent.editAndSave((settings) => {
      settings.showTopBar = false;
    });
    expect(castTo<NavigatorBarComponentInternals>(navigatorBarComponent).getVisibility()).toMatchObject({ showBottomBar: true, showTopBar: false });
  });

  it('pulls past the note\'s edges by the current settings', async () => {
    const plugin = new Plugin(app, manifest);
    const addChildSpy = vi.spyOn(plugin, 'addChild');
    await plugin.onload();
    const overscrollComponent = addChildSpy.mock.results.map((result) => result.value as unknown).find((child) => child instanceof OverscrollComponent);
    const settingsComponent = getSettingsComponent(plugin);
    await settingsComponent.editAndSave((settings) => {
      settings.overscrollEdges = OverscrollEdges.Both;
    });
    expect(castTo<OverscrollComponentInternals>(overscrollComponent).getSettings()).toMatchObject({ overscrollDistancePercent: 33, overscrollEdges: OverscrollEdges.Both });
  });

  it('refreshes the navigator bars whenever the settings are loaded or saved, until it unloads', async () => {
    const refreshSpy = vi.spyOn(NavigatorBarComponent.prototype, 'refresh');
    const onSpy = vi.spyOn(PluginSettingsComponent.prototype, 'on');
    const offrefSpy = vi.spyOn(PluginSettingsComponent.prototype, 'offref');
    const navigatorBarOnloadSpy = vi.spyOn(NavigatorBarComponent.prototype, 'onload');
    const plugin = new Plugin(app, manifest);
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');
    plugin.load();
    await vi.waitFor(() => {
      expect(addCommandSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'open-demo-vault' }));
    });
    const settingsComponent = getSettingsComponent(plugin);

    refreshSpy.mockClear();
    await settingsComponent.editAndSave((settings) => {
      settings.pageSize = 5;
    });
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    refreshSpy.mockClear();
    await settingsComponent.loadFromFile(false);
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    // An unloaded plugin has no bars left to refresh, so it stops listening. The settings component's own
    // Listeners, added when it loads, before the bars exist, are its own business.
    const barsLoadOrder = ensureNonNullable(navigatorBarOnloadSpy.mock.invocationCallOrder[0]);
    const barsListenerIndices = onSpy.mock.invocationCallOrder.flatMap((order, index) => order > barsLoadOrder ? [index] : []);
    expect(barsListenerIndices.map((index) => onSpy.mock.calls[index]?.[0])).toStrictEqual(['loadSettings', 'saveSettings']);
    const settingsEventRefs = barsListenerIndices.map((index): unknown => onSpy.mock.results[index]?.value);
    expect(offrefSpy).not.toHaveBeenCalled();
    plugin.unload();
    const removedEventRefs = offrefSpy.mock.calls.map(([eventRef]) => eventRef);
    expect(removedEventRefs).toHaveLength(settingsEventRefs.length);
    expect(removedEventRefs).toEqual(expect.arrayContaining(settingsEventRefs));
  });
});
