const DEFAULT_PAGE_SIZE = 10;

export class PluginSettings {
  /**
   * How many items Page up and Page down move. They stop at the first and the last item.
   */
  public pageSize = DEFAULT_PAGE_SIZE;

  /**
   * Whether the navigator bar shows below the note, before the embedded backlinks.
   */
  public showBottomBar = true;

  /**
   * Whether the navigator bar shows above the note, after the inline title and the properties.
   */
  public showTopBar = true;
}
