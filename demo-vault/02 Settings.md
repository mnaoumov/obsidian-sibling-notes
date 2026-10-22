# Settings

Every setting `Sibling Notes` stores, listed by the **key it is written under in `data.json`** rather than by its display label — that is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → `Sibling Notes`**.

## General

- `showTopBar`
  - `true` or `false`, `true` by default, shown in the settings tab as **Show the top bar**. Whether the navigator bar shows above the note, before the inline title and the properties. See [03 Navigator bar](<./03 Navigator bar.md>).
- `showBottomBar`
  - `true` or `false`, `true` by default, shown in the settings tab as **Show the bottom bar**. Whether the navigator bar shows below the note, before the embedded backlinks.
- `pageSize`
  - a whole number, 10 by default, shown in the settings tab as **Page size**. How many items **Go a page up in the folder** and **Go a page down in the folder** move. They stop at the first and the last item.

## Scrolling past the edge

Opening the next or previous item by scrolling past a note's edge. See [06 Scroll past the edge](<./06 Scroll past the edge.md>).

- `overscrollEdges`
  - `"none"`, `"bottom"` or `"both"`, `"none"` by default, shown in the settings tab as **Open by scrolling past the edge** with the choices **Off**, **Bottom edge only: next** and **Both edges: previous and next**. Which edges open an item when scrolled past.
- `overscrollDistancePercent`
  - a number from 1 to 100, 33 by default, shown in the settings tab as **Pull distance**. How far to keep scrolling past the edge before the item opens, as a percentage of the height of the note on screen.

## Folder notes

Which note a virtual folder note shows as the folder's note. See [04 Virtual folder note](<./04 Virtual folder note.md>).

- `shouldReadFolderNotePlugins`
  - `true` or `false`, `true` by default, shown in the settings tab as **Follow folder-notes plugins**. Whether the setup of the enabled folder-notes plugins counts: `Folder notes`, `Folder Note`, `Waypoint` and `Folder Index`.
- `shouldUseFolderNoteInside`
  - `true` or `false`, `true` by default, shown in the settings tab as **Note inside the folder**. Whether a note inside the folder and named after it counts: `d/d.md` for the folder `d`.
- `shouldUseFolderNoteBeside`
  - `true` or `false`, `true` by default, shown in the settings tab as **Note beside the folder**. Whether a note beside the folder and named after it counts: `d.md` for the folder `d`.

## Try it

Change the setting without leaving this note. The change applies live, so there is no reload.

```code-button
---
caption: Set pageSize to 2
---
await require('/demoSetup.ts').setPageSize(app, 2);
```

Manual equivalent: type `2` into **Page size** in the settings tab.

With a page size of 2, open `Chapter 1` in [01 Folder navigation](<./01 Folder navigation.md>) and go a page down: you land on `Chapter 3`. When you are done, put it back:

```code-button
---
caption: Reset pageSize to its default
---
await require('/demoSetup.ts').setPageSize(app, 10);
```

Manual equivalent: type `10` back into the field.
