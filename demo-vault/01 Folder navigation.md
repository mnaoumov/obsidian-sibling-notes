# Folder navigation

`Sibling Notes` moves between the items of one folder in the order the File explorer shows them. Each step is a command, so you can bind a hotkey to it.

The walkthrough below uses the folder `Materials/01 Folder navigation/`. The File explorer shows it as the subfolder [Appendix](<./Materials/01 Folder navigation/Appendix/Notes.md>) first, because folders sit on top, and then [Chapter 1](<./Materials/01 Folder navigation/Chapter 1.md>), [Chapter 2](<./Materials/01 Folder navigation/Chapter 2.md>) and [Chapter 3](<./Materials/01 Folder navigation/Chapter 3.md>).

## Step through a folder

Open `Chapter 1` to start from it.

```code-button
---
caption: Open Chapter 1
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 1.md');
```

Manual equivalent: click `Chapter 1` in the File explorer.

Now step to the next item. Run it twice and you are on `Chapter 3`, the last item. Next is then unavailable, because the sequence does not wrap around.

```code-button
---
caption: Go to the next item
---
await require('/demoSetup.ts').runNavigationCommand(app, 'go-to-next');
```

Manual equivalent: run **`Sibling Notes`: Go to the next item in the folder** in the Command Palette (`Ctrl+P` / `Cmd+P`).

The other steps work the same way:

- **Go to the previous item in the folder** steps back one item.
- **Go to the first item in the folder** and **Go to the last item in the folder** jump to either end.
- **Go a page up in the folder** and **Go a page down in the folder** move several items at once, and stop at the ends. How many is the **Page size** setting, in [02 Settings](<./02 Settings.md>).

```code-button
---
caption: Go to the first item
---
await require('/demoSetup.ts').runNavigationCommand(app, 'go-to-first');
```

Manual equivalent: run **`Sibling Notes`: Go to the first item in the folder**.

The first item is the subfolder `Appendix`. A subfolder is an item like any other: landing on it opens its **virtual folder note**, a view that lists what the folder holds, and the next step goes on from it to `Chapter 1`. [04 Virtual folder note](<./04 Virtual folder note.md>) describes that view.

## Go into a subfolder

On a subfolder's virtual folder note, **Go into the folder, to its first item** opens the first item inside it.

```code-button
---
caption: Go to the first item, then go into it
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 1.md');
await require('/demoSetup.ts').runNavigationCommand(app, 'go-to-first');
await require('/demoSetup.ts').runNavigationCommand(app, 'enter-folder');
```

Manual equivalent: run **`Sibling Notes`: Go to the first item in the folder**, then **`Sibling Notes`: Go into the folder, to its first item**, or press **Enter** on the virtual folder note.

`Appendix/Appendix` should now be open. It is the first item of `Appendix`, and it is also that folder's folder note.

## Go up

From a note inside a subfolder, **Go up to the parent folder** goes to the parent folder's sequence and lands on the subfolder you just left, which opens its virtual folder note.

```code-button
---
caption: Open Appendix/Notes, then go up
---
await require('/demoSetup.ts').openMaterial(app, 'Appendix/Notes.md');
await require('/demoSetup.ts').runNavigationCommand(app, 'go-up');
```

Manual equivalent: open `Notes` in `Appendix`, then run **`Sibling Notes`: Go up to the parent folder**.

## Your own sort order

The steps follow whatever order the File explorer shows, so change its sort order and they change with it. Sort the File explorer from Z to A, then step from `Chapter 2`:

```code-button
---
caption: Sort from Z to A, open Chapter 2, then go to the next item
---
await require('/demoSetup.ts').setFileExplorerSortOrder(app, 'alphabeticalReverse');
await require('/demoSetup.ts').openMaterial(app, 'Chapter 2.md');
await require('/demoSetup.ts').runNavigationCommand(app, 'go-to-next');
```

Manual equivalent: click the sort button at the top of the File explorer, pick **File name (Z to A)**, open `Chapter 2` and run **`Sibling Notes`: Go to the next item in the folder**.

`Chapter 1` should now be open, because it comes after `Chapter 2` in Z to A order. The subfolder `Appendix` stays first: the File explorer keeps folders on top in every sort order, and so does the plugin. Put the order back:

```code-button
---
caption: Sort from A to Z again
---
await require('/demoSetup.ts').setFileExplorerSortOrder(app, 'alphabetical');
```

Manual equivalent: pick **File name (A to Z)** from the same sort button.

A plugin that sorts the File explorer its own way, such as `Custom File Explorer sorting`, is followed too, because the plugin asks the File explorer for its order rather than sorting by itself. When the File explorer is turned off, the steps fall back to name order.
