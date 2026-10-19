const DEFAULT_PAGE_SIZE = 10;

export class PluginSettings {
  /**
   * How many items Page up and Page down move. They stop at the first and the last item.
   */
  public pageSize = DEFAULT_PAGE_SIZE;

  /**
   * Whether the conventions configured in the enabled folder-notes plugins count when a folder's note is
   * looked up: `Folder notes`, `Folder Note`, `Waypoint` and `Folder Index`.
   */
  public shouldReadFolderNotePlugins = true;

  /**
   * Whether a note named after its folder, beside the folder, is the folder's note: `d.md` for `d`.
   */
  public shouldUseFolderNoteBeside = true;

  /**
   * Whether a note named after its folder, inside the folder, is the folder's note: `d/d.md` for `d`.
   */
  public shouldUseFolderNoteInside = true;

  /**
   * Whether the navigator bar shows below the note, before the embedded backlinks.
   */
  public showBottomBar = true;

  /**
   * Whether the navigator bar shows above the note, after the inline title and the properties.
   */
  public showTopBar = true;
}
