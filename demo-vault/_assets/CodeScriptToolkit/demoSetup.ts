import type { App } from 'obsidian';

import { configureCommunityPlugin } from '@mnaoumov/obsidian-lib/community-plugins';
import { Notice } from 'obsidian';

// Shared code for every `code-button` in this vault, so each note's button stays a one-liner instead of a
// Block copy-pasted across notes.
//
// The plugin id has to match `manifest.json` exactly: commands are keyed by it, and so is `data.json`.
const PLUGIN_ID = 'sibling-notes';

const MATERIALS_FOLDER_PATH = 'Materials/01 Folder navigation';

/**
 * Opens a note of the folder the walkthrough steps through.
 *
 * Manual equivalent: click the note in the File explorer.
 */
export async function openMaterial(app: App, relativePath: string): Promise<void> {
  const path = `${MATERIALS_FOLDER_PATH}/${relativePath}`;
  const file = app.vault.getFileByPath(path);
  if (!file) {
    new Notice(`The demo note ${path} is missing.`);
    return;
  }
  await app.workspace.getLeaf(false).openFile(file);
}

/**
 * Runs one of the plugin's navigation commands, such as `go-to-next`.
 *
 * A command whose step has nowhere to go is unavailable, and so is not run: say so rather than do nothing.
 *
 * Manual equivalent: the same command in the Command Palette.
 */
export async function runNavigationCommand(app: App, commandId: string): Promise<void> {
  const command = app.commands.findCommand(`${PLUGIN_ID}:${commandId}`);
  if (!command?.checkCallback?.(true)) {
    new Notice(`There is nowhere to go with ${command?.name ?? commandId} from here.`);
    return;
  }
  app.commands.executeCommandById(`${PLUGIN_ID}:${commandId}`);
  await Promise.resolve();
}

/**
 * Shows or hides one of the navigator bars, through its `showTopBar` or `showBottomBar` setting. The change
 * applies live, like {@link setPageSize}.
 *
 * Manual equivalent: the **Show the top bar** or **Show the bottom bar** toggle in
 * **Settings -> Community plugins -> Sibling Notes**.
 */
export async function setBarVisibility(app: App, key: 'showBottomBar' | 'showTopBar', isShown: boolean): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: { [key]: isShown } });
  new Notice(`${key} is now ${String(isShown)}. It is live -- no reload needed.`);
}

/**
 * Sets the plugin's `pageSize`.
 *
 * `configureCommunityPlugin` routes through the plugin's own settings component while it is loaded, so the
 * change applies live -- no window reload, and no writing `data.json` behind a running plugin's back, which
 * it would overwrite from memory as it unloads.
 *
 * Manual equivalent: change **Page size** in **Settings -> Community plugins -> Sibling Notes**.
 */
export async function setPageSize(app: App, value: number): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: { pageSize: value } });
  new Notice(`pageSize is now ${String(value)}. It is live -- no reload needed.`);
}
