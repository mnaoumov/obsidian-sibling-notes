# Start here

This is an [Obsidian](https://obsidian.md/) vault that documents the [Sibling Notes](https://github.com/mnaoumov/obsidian-sibling-notes/) plugin by demonstrating it. Every feature has a note that says what it does and why you would want it, and a button you can press to watch it happen.

Step through the notes of a folder in File explorer order, with a navigator bar above and below the note and a folder map.

## Your first minute

Below this paragraph is a **code button** — a captioned rectangle. It is not a picture of a button: **clicking it runs the code**, and the result appears underneath it. The `</>` toggle beside the caption reveals the code it runs, so nothing here is a black box.

```code-button
---
caption: Open Chapter 1, then go to the next item
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 1.md');
await require('/demoSetup.ts').runNavigationCommand(app, 'go-to-next');
```

`Chapter 2` should now be open: it is the item after `Chapter 1` in the File explorer. That is the plugin's **Go to the next item in the folder** command, the same thing you get from **`Sibling Notes`: Go to the next item in the folder** in the Command Palette (`Ctrl+P` / `Cmd+P`).

Every button in this vault also states its **manual equivalent**, so you learn the real steps rather than depending on the buttons.

## Features

| Note | What it covers |
| --- | --- |
| [01 Folder navigation](<./01 Folder navigation.md>) | The commands that step through a folder, and how they follow the File explorer. |
| [02 Settings](<./02 Settings.md>) | Every setting, by the key it is stored under in `data.json`. |
| [03 Navigator bar](<./03 Navigator bar.md>) | The bar above and below every note: its buttons, the position, and hiding it. |
| [04 Virtual folder note](<./04 Virtual folder note.md>) | What a subfolder is in the sequence: its items, Enter, and its folder note. |
| [05 Folder map](<./05 Folder map.md>) | The whole folder at a glance: where each button goes, and pinning it to the side panel. |

## Materials

`Materials/` holds the notes the walkthroughs operate on, so you never have to build a fixture to see a feature working.
