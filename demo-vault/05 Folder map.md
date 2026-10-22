# Folder map

The navigator bar shows where you are in a folder, `3 / 4`. The **folder map** shows the whole folder: its items in File explorer order, the note you are on, and where each button of the bar would take you.

Open `Chapter 2` and show its folder map.

```code-button
---
caption: Open Chapter 2, then show the folder map
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 2.md');
require('/demoSetup.ts').showFolderMap(app);
```

Manual equivalent: open `Chapter 2` and click the map button at the right end of the navigator bar, or run **`Sibling Notes`: Show the folder map** in the Command Palette (`Ctrl+P` / `Cmd+P`).

On desktop the map opens as a popover under the button. On mobile it rises from the bottom of the screen as a sheet. `Escape`, a click outside it, or the map button again closes it.

## What it shows

- **Breadcrumbs** at the top: the vault, then each folder down to this one, `Materials / 01 Folder navigation`. Click a folder to open its [virtual folder note](<./04 Virtual folder note.md>).
- **The folder's items**, subfolders first, in the order the File explorer shows them. The note you are on is highlighted.
- **Each button's target.** An item that a button of the bar would reach carries that button's icon: the previous-item chevron on `Chapter 1`, the next-item chevron on `Chapter 3`. The up button's folder icon sits on the folder's own breadcrumb, because that is where going up lands.
- **Hovering a button** of the bar outlines its target in the map, so you can see where a click would take you before you click.

## Go somewhere

Click an item to open it. Click a subfolder, such as `Appendix`, to go into it: its first item opens, and the map now lists the subfolder. Hold `Ctrl` / `Cmd`, or click with the middle button, to open the item in a new tab.

## Pin it

The pin at the top of the map moves it to the right side panel, where it stays open and follows whichever note you are on. While the map is pinned, the map button reveals the side panel instead of opening a popover.

```code-button
---
caption: Pin the folder map
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 2.md');
require('/demoSetup.ts').pinFolderMap(app);
```

Manual equivalent: click the pin at the top of the folder map, or run **`Sibling Notes`: Pin the folder map to the side panel**.

Unpin it:

```code-button
---
caption: Unpin the folder map
---
require('/demoSetup.ts').unpinFolderMap(app);
```

Manual equivalent: close the folder map's tab in the right side panel.
