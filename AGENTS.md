# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Overview

`Sibling Notes` moves between the notes of one folder in the order the File explorer shows them. A navigator bar above the note and another below it step to the previous or next item, and a folder map lists the whole folder.

What core 1.14.4 and other plugins already do, so the plugin does not rebuild it:

- **Core has no previous or next note in a folder,** as a command or as UI. Bases never shows note bodies.
- **Commands exist in other plugins:** `Neighbouring Files`, `Note Navigator`, `Page Flow`, `Quick Explorer` and `Explorer Stepper`. None of them puts buttons above and below the note, and every one ignores custom-sort plugins: they re-sort by the built-in setting or by name. `Page Flow` reads the rendered tree, which is only partly rendered.
- **Continuous scrolling over many notes exists:** `Continuous Mode`, `Folder Reader` and `Simple Journal`. It is out of scope here.

## Current state

**Scaffolded, nothing built yet.** The repo was generated on 2026-10-17 with `create-obsidian-plugin` (preset `all-in-one`, CSS, desktop and mobile, the unofficial API subset, no editor extensions). Its answers are in `.create-obsidian-plugin.json`, so re-running the generator in this folder updates every file not edited by hand. Everything under `src/` is still the generator's sample code, and the demo vault is still its sample vault. The coverage thresholds stay at 0 until real code replaces the samples.

**No GitHub remote exists yet.** `mnaoumov/obsidian-sibling-notes` has not been created, so nothing is pushed and nothing is released. The plugin id `sibling-notes` was free in the community directory on 2026-10-17. An id can never change once it is published, so check it again right before the first submission.

## Design

This is the model the owner approved. Refine it as the build goes.

**The sequence.** A folder's sequence is its own items in File explorer order, the same folder only. Each subfolder appears in it as a **virtual folder note**. There is no wrap-around: on the first item Previous is greyed out, and on the last item Next is.

**The virtual folder note.** It is a custom view, not a file. It lists what the folder holds, subfolders and files, in explorer order, each one clickable. When the folder has a folder note, its content is shown too. Which folder-note conventions count is a setting. By default they are the major folder-notes plugins' conventions, read from their settings where they expose them, plus `d/d.md` and a `d.md` beside the folder. The view offers **Enter**, which goes to the folder's first item.

**The navigator bar**, above the note and below it, in Live Preview, Reading view and the virtual view, on desktop and mobile:

- `..` (Up) is always available. It goes to the parent folder's sequence and lands on the folder just left.
- Home and End go to the first and last item.
- Page up and Page down move N items (a setting, 10 by default) and stop at the ends.
- Previous and Next, with a position such as `3 / 12` between them.
- Map.

**The map.** A popover on desktop, a side panel when pinned, and a bottom sheet on mobile. It lists the folder's items in explorer order under breadcrumbs (`a / b / d`) and highlights the current item. Each item a bar button would reach carries that button's icon, and hovering a button highlights its target. Clicking an item goes to it, and clicking a subfolder enters it.

**Commands.** Every bar action is also a command, with a bindable hotkey.

**Later, not in version 1:**

- Scrolling past the end or above the top to move to the next or previous item.
- A joined, editable view of the whole folder. It would need one embedded editor per note through internal APIs.

## Internals

Checked against the `obsidian-typings` branch `release/obsidian-public/1.14.4`. Verify every member against a live build before relying on it.

- **Order:** `FileExplorerView.getSortedFolderItems(folder)`, with `sortOrder` and `requestSort` beside it. The custom-sort plugins (`Custom File Explorer sorting`, `Flexplorer`) patch this exact method, so it returns what the user sees. Recompute it on every use. Fall back to name order when the File explorer is disabled or its view is not loaded. `AppVaultConfig.fileSortOrder` is too loosely typed to rely on.
- **Where the bars go:**
  - In a `MarkdownView`, `inlineTitleEl` for the top and `backlinksEl` for the bottom.
  - In Live Preview, `MarkdownScrollableEditView.sizerEl`. A bottom bar must trigger the re-measure in `updateBottomPadding`.
  - In Reading view, the `MarkdownPreviewRenderer` header and footer, and its `onRendered`.
  - Check the CSS class names against a live build.
- Anything missing from `obsidian-typings` is added there, never declared locally.

## Conventions

- Gates: `npm run gate` runs format, spellcheck, markdown lint with link checks, build, lint, `find-overexposed` and unit-test coverage.
