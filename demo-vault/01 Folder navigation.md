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

The first item is the subfolder `Appendix`. A subfolder is an item like any other: landing on it shows it in the File explorer, and the next step goes on from it to `Chapter 1`.

## Go up

From a note inside a subfolder, **Go up to the parent folder** goes to the parent folder's sequence and lands on the subfolder you just left.

```code-button
---
caption: Open Appendix/Notes, then go up
---
await require('/demoSetup.ts').openMaterial(app, 'Appendix/Notes.md');
await require('/demoSetup.ts').runNavigationCommand(app, 'go-up');
```

Manual equivalent: open `Notes` in `Appendix`, then run **`Sibling Notes`: Go up to the parent folder**.

## Your own sort order

The steps follow whatever order the File explorer shows, so change its sort order and they change with it. A plugin that sorts the File explorer its own way is followed too. When the File explorer is turned off, the steps fall back to name order.
