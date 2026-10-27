import type { FolderNoteConfig } from '@mnaoumov/obsidian-lib/folder-note';
import type {
  App,
  TFile,
  TFolder
} from 'obsidian';

import { MARKDOWN_FILE_EXTENSION } from '@mnaoumov/obsidian-lib/file-system';
import {
  FOLDER_NOTES_PLUGIN_ID,
  FolderNoteLocation,
  resolveFolderNote,
  resolveFolderNoteConfig
} from '@mnaoumov/obsidian-lib/folder-note';

/**
 * Which folder-note conventions count.
 */
export interface FolderNoteConventions {
  /**
   * Whether the conventions configured in the enabled folder-notes plugins count: `Folder notes`,
   * `Folder Note`, `Waypoint` and `Folder Index`.
   */
  readonly shouldReadFolderNotePlugins: boolean;

  /**
   * Whether a note named after its folder, beside the folder, counts: `d.md` for `d`.
   */
  readonly shouldUseFolderNoteBeside: boolean;

  /**
   * Whether a note named after its folder, inside the folder, counts: `d/d.md` for `d`.
   */
  readonly shouldUseFolderNoteInside: boolean;
}

type PluginSettingsRecord = Readonly<Partial<Record<string, unknown>>>;

/**
 * The `Folder Note` plugin's id.
 */
const FOLDER_NOTE_PLUGIN_ID = 'folder-note-plugin';

/**
 * The `Folder Index` plugin's id.
 */
const FOLDER_INDEX_PLUGIN_ID = 'obsidian-folder-index';

/**
 * The `Waypoint` plugin's id.
 */
const WAYPOINT_PLUGIN_ID = 'waypoint';

const INSIDE_NAMED_AFTER_FOLDER = createConfig(FolderNoteLocation.InsideFolder);
const BESIDE_NAMED_AFTER_FOLDER = createConfig(FolderNoteLocation.ParentFolder);

/**
 * Finds a folder's folder note under the conventions that count. The enabled plugins' conventions are
 * tried first, in the order of their downloads, then a note inside the folder, then one beside it.
 *
 * The plugins' settings are read on every call, so a plugin reconfigured, enabled or disabled is followed
 * at once. Nothing is ever created.
 *
 * @param app - The Obsidian app.
 * @param folder - The folder.
 * @param conventions - Which conventions count.
 * @returns The folder note, or `null` when the folder has none.
 */
export function findFolderNote(app: App, folder: TFolder, conventions: FolderNoteConventions): null | TFile {
  for (const config of getFolderNoteConfigs(app, conventions)) {
    const folderNote = resolveFolderNote({ app, config, folder });
    if (folderNote) {
      return folderNote;
    }
  }
  return null;
}

function createConfig(location: FolderNoteLocation.InsideFolder | FolderNoteLocation.ParentFolder, name?: string): FolderNoteConfig {
  return {
    extensions: [MARKDOWN_FILE_EXTENSION],
    isHidden: false,
    location,
    resolveName: (folder): string => name ?? folder.name
  };
}

function getFolderIndexConfig(settings: PluginSettingsRecord): FolderNoteConfig {
  const { indexFilename, indexFileUserSpecified } = settings;
  return indexFileUserSpecified === true && typeof indexFilename === 'string'
    ? createConfig(FolderNoteLocation.InsideFolder, indexFilename)
    : INSIDE_NAMED_AFTER_FOLDER;
}

function getFolderNoteConfigs(app: App, conventions: FolderNoteConventions): FolderNoteConfig[] {
  const configs: FolderNoteConfig[] = [];
  if (conventions.shouldReadFolderNotePlugins) {
    if (app.plugins.getPlugin(FOLDER_NOTES_PLUGIN_ID)) {
      configs.push(resolveFolderNoteConfig({ app }));
    }
    const folderNoteSettings = getPluginSettings(app, FOLDER_NOTE_PLUGIN_ID);
    if (folderNoteSettings) {
      configs.push(getFolderNotePluginConfig(folderNoteSettings));
    }
    const waypointSettings = getPluginSettings(app, WAYPOINT_PLUGIN_ID);
    if (waypointSettings) {
      configs.push(getWaypointConfig(waypointSettings));
    }
    const folderIndexSettings = getPluginSettings(app, FOLDER_INDEX_PLUGIN_ID);
    if (folderIndexSettings) {
      configs.push(getFolderIndexConfig(folderIndexSettings));
    }
  }
  if (conventions.shouldUseFolderNoteInside) {
    configs.push(INSIDE_NAMED_AFTER_FOLDER);
  }
  if (conventions.shouldUseFolderNoteBeside) {
    configs.push(BESIDE_NAMED_AFTER_FOLDER);
  }
  return configs;
}

function getFolderNotePluginConfig(settings: PluginSettingsRecord): FolderNoteConfig {
  const { folderNoteName, folderNoteType } = settings;
  switch (folderNoteType) {
    case 'index': {
      return typeof folderNoteName === 'string' ? createConfig(FolderNoteLocation.InsideFolder, folderNoteName) : INSIDE_NAMED_AFTER_FOLDER;
    }
    case 'outside': {
      return BESIDE_NAMED_AFTER_FOLDER;
    }
    default: {
      return INSIDE_NAMED_AFTER_FOLDER;
    }
  }
}

/**
 * Returns an enabled plugin's settings object.
 *
 * @param app - The Obsidian app.
 * @param pluginId - The plugin's id.
 * @returns The settings, or `null` when the plugin is not enabled or keeps no settings object.
 */
function getPluginSettings(app: App, pluginId: string): null | PluginSettingsRecord {
  const plugin = app.plugins.getPlugin(pluginId);
  if (!plugin || !('settings' in plugin)) {
    return null;
  }
  const { settings } = plugin;
  return typeof settings === 'object' && settings !== null ? settings as PluginSettingsRecord : null;
}

function getWaypointConfig(settings: PluginSettingsRecord): FolderNoteConfig {
  const { folderNoteFilename, folderNoteType } = settings;
  switch (folderNoteType) {
    case 'CUSTOM_FILENAME': {
      return typeof folderNoteFilename === 'string' ? createConfig(FolderNoteLocation.InsideFolder, folderNoteFilename) : INSIDE_NAMED_AFTER_FOLDER;
    }
    case 'OUTSIDE_FOLDER': {
      return BESIDE_NAMED_AFTER_FOLDER;
    }
    default: {
      return INSIDE_NAMED_AFTER_FOLDER;
    }
  }
}
