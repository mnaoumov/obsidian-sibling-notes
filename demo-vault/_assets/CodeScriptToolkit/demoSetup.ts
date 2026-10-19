import type { App } from 'obsidian';

import { configureCommunityPlugin } from '@mnaoumov/obsidian-lib/community-plugins';
import { Notice } from 'obsidian';

// Shared code for every `code-button` in this vault, so each note's button stays a one-liner instead of a
// Block copy-pasted across notes.
//
// The plugin id has to match `manifest.json` exactly: commands are keyed by it, and so is `data.json`.
const PLUGIN_ID = 'sibling-notes';

const MATERIALS_FOLDER_PATH = 'Materials/01 Folder navigation';

// The view type of the plugin's virtual folder note.
const VIRTUAL_FOLDER_NOTE_VIEW_TYPE = 'sibling-notes-virtual-folder-note';

const LANDING_POLL_IN_MILLISECONDS = 50;
const LANDING_TIMEOUT_IN_MILLISECONDS = 2000;

/**
 * Describes what the active leaf shows, so a change of file or of folder can be told.
 */
function getActiveViewState(app: App): string {
  return JSON.stringify(app.workspace.getMostRecentLeaf()?.getViewState().state ?? null);
}

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
 * Opens the virtual folder note of a folder the walkthrough uses, such as `Appendix`.
 *
 * Manual equivalent: go to the folder with the plugin's commands, or click it on another virtual folder note.
 */
export async function openMaterialFolder(app: App, relativePath: string): Promise<void> {
  const path = relativePath ? `${MATERIALS_FOLDER_PATH}/${relativePath}` : MATERIALS_FOLDER_PATH;
  if (!app.vault.getFolderByPath(path)) {
    new Notice(`The demo folder ${path} is missing.`);
    return;
  }
  await app.workspace.getLeaf(false).setViewState({ active: true, state: { folderPath: path }, type: VIRTUAL_FOLDER_NOTE_VIEW_TYPE });
}

/**
 * Runs one of the plugin's navigation commands, such as `go-to-next`, and waits until it has landed, so the
 * next command in the same button starts from where this one went.
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
  const stateBefore = getActiveViewState(app);
  app.commands.executeCommandById(`${PLUGIN_ID}:${commandId}`);
  const deadline = performance.now() + LANDING_TIMEOUT_IN_MILLISECONDS;
  while (getActiveViewState(app) === stateBefore && performance.now() < deadline) {
    await sleep(LANDING_POLL_IN_MILLISECONDS);
  }
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
 * Switches one folder-note convention on or off, through its setting. The change applies live, like
 * {@link setPageSize}: an open virtual folder note shows or drops its folder note at once.
 *
 * Manual equivalent: the toggles under **Folder notes** in **Settings -> Community plugins -> Sibling Notes**.
 */
export async function setFolderNoteConvention(
  app: App,
  key: 'shouldReadFolderNotePlugins' | 'shouldUseFolderNoteBeside' | 'shouldUseFolderNoteInside',
  isUsed: boolean
): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: { [key]: isUsed } });
  new Notice(`${key} is now ${String(isUsed)}. It is live -- no reload needed.`);
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
