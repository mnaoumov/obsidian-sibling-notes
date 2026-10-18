# Start here

This is an [Obsidian](https://obsidian.md/) vault that documents the [Sibling Notes](https://github.com/mnaoumov/obsidian-sibling-notes/) plugin by demonstrating it. Every feature has a note that says what it does and why you would want it, and a button you can press to watch it happen.

Step through the notes of a folder in File explorer order, with a navigator bar above and below the note and a folder map.

## Your first minute

Below this paragraph is a **code button** — a captioned rectangle. It is not a picture of a button: **clicking it runs the code**, and the result appears underneath it. The `</>` toggle beside the caption reveals the code it runs, so nothing here is a black box.

```code-button
---
caption: Run the Sample command
---
require('/demoSetup.ts').runSampleCommand(app);
```

A notice should have appeared in the top-right corner. That is the plugin's `Sample` command running — the same thing you get from **`Sibling Notes`: Sample** in the Command Palette (`Ctrl+P` / `Cmd+P`).

Every button in this vault also states its **manual equivalent**, so you learn the real steps rather than depending on the buttons.

## Features

| Note | What it covers |
| --- | --- |
| [01 Sample commands](<./01 Sample commands.md>) | The commands the plugin adds, and how to run them. |
| [02 Settings](<./02 Settings.md>) | Every setting, by the key it is stored under in `data.json`. |

## Materials

`Materials/` holds the notes the walkthroughs operate on, so you never have to build a fixture to see a feature working.
