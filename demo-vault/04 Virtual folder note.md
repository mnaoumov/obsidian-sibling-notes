# Virtual folder note

In a folder's sequence, a subfolder is an item like any note. `Sibling Notes` shows it as a **virtual folder note**: a view, not a file, that lists what the folder holds and shows the folder's folder note, when it has one. Nothing is written to your vault.

Open the virtual folder note of `Appendix`, the subfolder of `Materials/01 Folder navigation/`.

```code-button
---
caption: Open the virtual folder note of Appendix
---
await require('/demoSetup.ts').openMaterialFolder(app, 'Appendix');
```

Manual equivalent: open `Chapter 1` and run **`Sibling Notes`: Go to the first item in the folder**. Landing on a subfolder with any of the plugin's steps opens its virtual folder note.

## What it shows

From top to bottom:

- The navigator bar, as on a note. Its position is the folder's place among its siblings: `1 / 4` for `Appendix`. See [03 Navigator bar](<./03 Navigator bar.md>).
- The folder's name.
- An **Enter** button, which goes to the folder's first item. It is greyed out when the folder is empty.
- The folder's items, subfolders and files, in the order the File explorer shows them. Click one to open it here. Hold `Ctrl` / `Cmd`, or click with the middle button, to open it in a new tab.
- The folder note: [Appendix](<./Materials/01 Folder navigation/Appendix/Appendix.md>), rendered below a link that opens it.
- The navigator bar again.

The view follows the vault: add, rename or delete an item, edit the folder note, or change the File explorer's sort order, and it updates.

## Enter

Press **Enter** to go to the first item.

```code-button
---
caption: Open Appendix, then enter it
---
await require('/demoSetup.ts').openMaterialFolder(app, 'Appendix');
await require('/demoSetup.ts').runNavigationCommand(app, 'enter-folder');
```

Manual equivalent: click **Enter**, or run **`Sibling Notes`: Go into the folder, to its first item** in the Command Palette (`Ctrl+P` / `Cmd+P`).

## Which note is the folder note

Folder notes are a convention, not an Obsidian feature, so the plugin looks for them in three ways, each one a setting:

- **Follow folder-notes plugins** reads the setup of the folder-notes plugins you have enabled: `Folder notes`, `Folder Note`, `Waypoint` and `Folder Index`. Reconfigure one of them and the plugin follows at once.
- **Note inside the folder** uses a note inside the folder and named after it: `Appendix/Appendix.md`.
- **Note beside the folder** uses a note beside the folder and named after it: `Appendix.md` next to `Appendix/`.

The first one that finds a note wins, in that order. Turn off the inside convention, and `Appendix` has no folder note anymore:

```code-button
---
caption: Stop using a note inside the folder
---
await require('/demoSetup.ts').setFolderNoteConvention(app, 'shouldUseFolderNoteInside', false);
await require('/demoSetup.ts').openMaterialFolder(app, 'Appendix');
```

Manual equivalent: turn off **Note inside the folder** under **Folder notes** in **Settings → Community plugins → `Sibling Notes`**.

Put it back:

```code-button
---
caption: Use a note inside the folder again
---
await require('/demoSetup.ts').setFolderNoteConvention(app, 'shouldUseFolderNoteInside', true);
```

Manual equivalent: turn **Note inside the folder** back on. Every setting is listed in [02 Settings](<./02 Settings.md>).
