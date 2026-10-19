# Navigator bar

`Sibling Notes` puts a navigator bar above every note, after the inline title and the properties, and another below it, before the embedded backlinks. Both scroll with the note. They show in Live Preview, Source mode and Reading view, and on a subfolder's [virtual folder note](<./04 Virtual folder note.md>), on desktop and on mobile.

Open `Chapter 2` to see them.

```code-button
---
caption: Open Chapter 2
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 2.md');
```

Manual equivalent: click `Chapter 2` in the File explorer, inside `Materials/01 Folder navigation/`.

## What the buttons do

From left to right:

- `..` goes up to the parent folder and lands on the folder you just left, like **Go up to the parent folder**.
- The first-item and last-item buttons jump to either end of the folder.
- The double chevrons move a page up or down: as many items as the **Page size** setting, stopping at the ends.
- The single chevrons step to the previous or next item.
- Between them, the position: `3 / 4` on `Chapter 2`, because the File explorer shows the subfolder `Appendix` first.
- The map button shows the [folder map](<./05 Folder map.md>).

A button with nowhere to go is greyed out. On `Chapter 3`, the last item, Next, Page down and the last-item button are all greyed out, because the sequence does not wrap around. Every button is also a command, described in [01 Folder navigation](<./01 Folder navigation.md>), so you can bind a hotkey to it.

The bar follows the File explorer. Change its sort order, or rename, add or delete a note in the folder, and the position updates.

## Hide a bar

Each bar has a setting. Hide the top bar:

```code-button
---
caption: Hide the top bar
---
await require('/demoSetup.ts').setBarVisibility(app, 'showTopBar', false);
```

Manual equivalent: turn off **Show the top bar** in **Settings → Community plugins → `Sibling Notes`**.

Put it back:

```code-button
---
caption: Show the top bar
---
await require('/demoSetup.ts').setBarVisibility(app, 'showTopBar', true);
```

Manual equivalent: turn **Show the top bar** back on. **Show the bottom bar** works the same way for the bar below the note. Both settings are listed in [02 Settings](<./02 Settings.md>).
