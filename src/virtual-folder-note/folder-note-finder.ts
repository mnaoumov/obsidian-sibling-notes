import type { FolderNoteConfig } from '@mnaoumov/obsidian-lib/folder-note';
import type {
  App,
  TFile,
  TFolder
} from 'obsidian';

import { MARKDOWN_FILE_EXTENSION } from '@mnaoumov/obsidian-lib/file-system';
import {
  FolderNoteLocation,
  resolveFolderNote,
  resolveFolderNotePluginConfigs
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

function createConfig(location: FolderNoteLocation.InsideFolder | FolderNoteLocation.ParentFolder): FolderNoteConfig {
  return {
    extensions: [MARKDOWN_FILE_EXTENSION],
    isHidden: false,
    location,
    resolveName: (folder): string => folder.name
  };
}

function getFolderNoteConfigs(app: App, conventions: FolderNoteConventions): FolderNoteConfig[] {
  const configs = conventions.shouldReadFolderNotePlugins ? resolveFolderNotePluginConfigs({ app }) : [];
  if (conventions.shouldUseFolderNoteInside) {
    configs.push(INSIDE_NAMED_AFTER_FOLDER);
  }
  if (conventions.shouldUseFolderNoteBeside) {
    configs.push(BESIDE_NAMED_AFTER_FOLDER);
  }
  return configs;
}
