const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_OVERSCROLL_DISTANCE_PERCENT = 33;

/**
 * Which edges of a note open the next or previous item when scrolled past.
 */
export enum OverscrollEdges {
  /**
   * The bottom edge opens the next item, and the top edge the previous one.
   */
  Both = 'both',

  /**
   * Only the bottom edge, which opens the next item.
   */
  Bottom = 'bottom',

  /**
   * Neither: scrolling past an edge does nothing.
   */
  None = 'none'
}

export class PluginSettings {
  /**
   * How far to keep scrolling past an edge before the next or previous item opens, as a percentage of the height
   * of the note on screen.
   */
  public overscrollDistancePercent = DEFAULT_OVERSCROLL_DISTANCE_PERCENT;

  /**
   * Which edges of a note open the next or previous item when scrolled past. Off by default, because it changes
   * how scrolling behaves.
   */
  public overscrollEdges = OverscrollEdges.None;

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
